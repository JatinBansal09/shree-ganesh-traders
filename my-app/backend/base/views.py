from django.contrib.auth import authenticate, login, logout, get_user_model
from django.utils import timezone
from django.core.paginator import Paginator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status, serializers
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from django.contrib.sessions.models import Session
from django.http import JsonResponse
from .models import PendingRegistration, UserSession, Customer, CustomerType, ProductCategory, ProductBrand, DiscountGroupCategoryMap, DiscountGroupSubCategoryMap, DiscountGroupBrandMap, ProductSubCategory, BrandSubCategoryMap, ProductBrand, ProductUnit, ProductMaterial, DiscountGroup, Product, CustomerDiscountGroup, UserGroupDiscountProfile, Orders, OrderItems, Conversation, ConversationParticipant, Message, OrderAction, Stock, Return, Payment, UserSettings, Inquiry
from rest_framework.decorators import api_view, permission_classes
from .services.sms_service import send_overdue_sms, send_owner_sms_report, send_sms
from django.db import transaction, IntegrityError
from dateutil.relativedelta import relativedelta
from django.db.models import F, Q, Max
from django.utils import timezone
from django.conf import settings
from cryptography.fernet import Fernet
from twilio.rest import Client
from django.utils import timezone
from django.db.models import Sum
from django.views import View
from datetime import datetime
import hashlib
import hmac
import json
import os
import re

User = get_user_model()

cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())

# ==================== HELPER FUNCTIONS ====================

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

class InquirySubmissionView(APIView):
    # This allows anyone (even people not logged in) to send the form
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data
        
        try:
            # 1. Save to Database
            inquiry = Inquiry.objects.create(
                company_name=data.get('Company_name'),
                inquiry_type=data.get('Interest_type'),
                email=data.get('Interest_email'),
                message=data.get('Interest_msg')
            )

            # 2. Send the Twilio SMS
            try:
                sms_body = (
                    f"🚀 New Lead: {data.get('Company_name')}\n"
                    f"Type: {data.get('Interest_type')}\n"
                    f"Message: {data.get('Interest_msg')}\n"
                    f"Email: {data.get('Interest_email')}"
                )
                send_owner_sms_report(sms_body)
            except Exception as sms_err:
                print(f"SMS failed: {sms_err}")

            return Response({"message": "Success"}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

def push_message_to_ws(conversation_id, message_data):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{conversation_id}",
        {
            "type": "chat_message",
            "data": message_data,
        }
    )

def get_device_fingerprint(request):
    """Generate server-side device fingerprint from request metadata"""
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    
    # Check if the request passed through a proxy
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    else:
        ip_address = request.META.get('REMOTE_ADDR', '')

    fingerprint = f"{user_agent}{ip_address}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()

def get_user_role(user):
    """Determine user role based on permissions"""
    if user.is_superuser==True and user.is_staff==False:
        return "Owner"
    elif user.is_superuser==False and user.is_staff==True:
        return "Employee"
    elif user.is_superuser==False and user.is_staff==False:
        return "Customer"

def get_actual_user_role(user):
    """Get the actual user role from CustomerType"""
    try:
        customer = Customer.objects.filter(user=user).first()
        return customer.customer_type.type_name
    except Customer.DoesNotExist:
        return "Unknown"

# views.py - CLASS-BASED (CORRECT)

class DebugAuthView(APIView):
    permission_classes = [AllowAny]  # ← This is correct for classes

    def get(self, request):
        return Response({
            "is_authenticated": request.user.is_authenticated,
            "user": str(request.user),
            "user_id": request.user.id if request.user.is_authenticated else None,
            "session_key": request.session.session_key,
            "cookies": dict(request.COOKIES),
            "session_cookie_age": request.session.get_expiry_age(),
            "session_expiry_date": request.session.get_expiry_date(),
        })

# ==================== SERIALIZERS ====================

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField()
    customer_name = serializers.CharField()
    phone_number = serializers.CharField()
    customer_address = serializers.CharField(required=False, allow_blank=True)
    gst_id = serializers.CharField(required=False, allow_blank=True)
    customer_userGroup = serializers.CharField(write_only=True)
    
    # New Fields
    status = serializers.BooleanField(default=True) # Maps to is_active
    shopName = serializers.CharField(required=False, allow_blank=True) # Maps to last_name

    class Meta:
        model = User
        fields = [
            "username", "email", "password",
            "customer_name", "phone_number", "customer_address",
            "gst_id", "customer_userGroup", "status", "shopName"
        ]

    # --- Uniqueness & Format Validations ---

    def validate(self, data):
        """
        Global validation for combined uniqueness: 
        Checks if customer_name, phone_number, and email combination exists.
        """
        email = data.get('email')
        phone = data.get('phone_number')
        name = data.get('customer_name')

        if Customer.objects.filter(
            customer_name=name, 
            phone_number=phone, 
            user__email=email
        ).exists():
            raise serializers.ValidationError(
                "A customer with this Name, Phone, and Email already exists."
            )
        return data

    def validate_username(self, value):
        if not re.match(r'^[a-zA-Z0-9_]{4,}$', value):
            raise serializers.ValidationError("Username must be 4+ chars (letters, numbers, underscores).")
        
        # Individual Uniqueness Check
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_phone_number(self, value):
        if not re.match(r'^[6-9]\d{9}$', value):
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        
        # Individual Uniqueness Check
        if Customer.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("This phone number is already registered.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_customer_userGroup(self, value):
        try:
            self.customer_type_obj = CustomerType.objects.get(type_name=value)
        except CustomerType.DoesNotExist:
            raise serializers.ValidationError("Invalid customer type.")
        return value

    # --- Create Logic ---
    def create(self, validated_data):
        request = self.context.get("request")
        with transaction.atomic():
            # 1. Extract data for Customer model
            customer_data = {
                "customer_name": validated_data.pop("customer_name"),
                "phone_number": validated_data.pop("phone_number"),
                "customer_address": validated_data.pop("customer_address", ""),
                "gst_id": validated_data.pop("gst_id", None),
            }

            if request and request.user.is_superuser:
                # The logic knows the Owner is the one typing
                is_active = True 
            else:
                # The logic knows this is a public signup
                is_active = False
            shop_name = validated_data.pop("shopName", "")
            
            # Get the group name from the validated data
            user_group_name = validated_data.pop("customer_userGroup")

            # 3. Logic for is_staff
            # We check if the group name is exactly 'Employee'
            is_staff_member = True if user_group_name == 'Employee' else False

            # 4. Create User (auth_user)
            user = User.objects.create_user(
                username=validated_data["username"],
                email=validated_data["email"],
                password=validated_data["password"],
                last_name=shop_name,      # ShopName -> last_name
                is_active=is_active,         # status -> is_active
                is_staff=is_staff_member  # Set based on userGroup
            )

            # 5. ONLY create Customer if NOT an Employee
            if not is_staff_member:
                Customer.objects.create(
                    user=user,
                    customer_type=self.customer_type_obj,
                    **customer_data
                )
            else:
                print(f"--- Skipping Customer record for Employee: {user.username} ---")

            return user

class ConsumerRegistrationView(APIView):
    """
    POST /api/consumer/register/  — Create new consumer (Employee only)
    PUT  /api/consumer/register/  — Edit existing consumer (Employee only)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # ✅ Only Employee (is_staff=True) can create consumers
        if not request.user.is_staff:
            return Response({"error": "Only employees can create consumers."}, status=403)

        data = request.data

        # ── Validate required fields ───────────────────────────────────────
        errors = {}
        if not data.get("customer_name", "").strip():
            errors["customer_name"] = "Full name is required."
        if not data.get("phone_number", "").strip():
            errors["phone_number"] = "Phone number is required."
        elif not re.match(r'^[6-9]\d{9}$', data["phone_number"]):
            errors["phone_number"] = "Enter a valid 10-digit phone number."
        if errors:
            return Response(errors, status=400)

        # ── Check phone uniqueness ─────────────────────────────────────────
        if Customer.objects.filter(phone_number=data["phone_number"]).exists():
            return Response(
                {"phone_number": "This phone number is already registered."},
                status=400
            )

        try:
            with transaction.atomic():
                # ✅ customer_type = Employee type (not Consumer)
                # because the Employee is the one managing these final consumers
                try:
                    employee_type = CustomerType.objects.get(type_name="Employee")
                except CustomerType.DoesNotExist:
                    return Response(
                        {"error": "Employee customer type not found. Please add it in admin."},
                        status=400
                    )

                # ✅ user = request.user (the Employee's auth user row, is_staff=True)
                customer = Customer.objects.create(
                    user=request.user,           # ✅ FK to Employee's auth_user row
                    customer_name=data["customer_name"].strip(),
                    phone_number=data["phone_number"].strip(),
                    gst_id=data.get("gst_id", "").strip() or None,
                    customer_address=data.get("customer_address", "").strip(),
                    customer_type=employee_type, # ✅ Employee type, not Consumer
                )

                return Response({
                    "success":  True,
                    "message":  "Consumer created successfully.",
                    "consumer": {
                        "id":               customer.id,
                        "customer_name":    customer.customer_name,
                        "phone_number":     customer.phone_number,
                        "gst_id":           customer.gst_id,
                        "customer_address": customer.customer_address,
                        "customer_type":    employee_type.type_name,
                        "user_id":          request.user.id,  # ✅ Employee's user id
                    }
                }, status=201)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def put(self, request):
        # ✅ Only Employee (is_staff=True) can edit consumers
        if not request.user.is_staff:
            return Response({"error": "Only employees can edit consumers."}, status=403)

        consumer_id = request.data.get("consumer_id")
        if not consumer_id:
            return Response({"error": "consumer_id is required."}, status=400)

        try:
            # ✅ Only allow editing consumers linked to this employee
            # user=request.user ensures Employee can only edit their own consumers
            customer = Customer.objects.get(
                id=consumer_id,
                user=request.user   # ✅ FK matches Employee's auth_user row (is_staff=True)
            )
        except Customer.DoesNotExist:
            return Response({"error": "Consumer not found or not assigned to you."}, status=404)

        data = request.data
        errors = {}

        # ── Validate ───────────────────────────────────────────────────────
        if not data.get("customer_name", "").strip():
            errors["customer_name"] = "Full name is required."

        new_phone = data.get("phone_number", "").strip()
        if not new_phone:
            errors["phone_number"] = "Phone number is required."
        elif not re.match(r'^[6-9]\d{9}$', new_phone):
            errors["phone_number"] = "Enter a valid 10-digit phone number."
        elif new_phone != customer.phone_number:
            if Customer.objects.exclude(id=customer.id).filter(
                phone_number=new_phone
            ).exists():
                errors["phone_number"] = "This phone number is already registered."

        if errors:
            return Response(errors, status=400)

        try:
            with transaction.atomic():
                customer.customer_name    = data["customer_name"].strip()
                customer.phone_number     = new_phone
                customer.gst_id           = data.get("gst_id", "").strip() or None
                customer.customer_address = data.get("customer_address", "").strip()
                # ✅ user and customer_type stay unchanged on edit
                customer.save()

                return Response({
                    "success": True,
                    "message": "Consumer updated successfully.",
                    "consumer": {
                        "id":               customer.id,
                        "customer_name":    customer.customer_name,
                        "phone_number":     customer.phone_number,
                        "gst_id":           customer.gst_id,
                        "customer_address": customer.customer_address,
                        "user_id":          request.user.id,  # ✅ Employee's user id
                    }
                }, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
class UserCustomerRowSerializer(serializers.ModelSerializer):

    user_id = serializers.IntegerField(source="user.id")

    username = serializers.CharField(source="user.username")

    email = serializers.EmailField(source="user.email")

    status = serializers.BooleanField(source="user.is_active")

    is_staff = serializers.BooleanField(source="user.is_staff")

    customer_name = serializers.SerializerMethodField()

    phone_number = serializers.SerializerMethodField()

    address = serializers.SerializerMethodField()

    customer_type = serializers.SerializerMethodField()

    logged_in_at = serializers.SerializerMethodField()



    class Meta:

        model = Customer

        fields = [

            "user_id", "username", "status", "email", "is_staff",

            "customer_name", "phone_number", "address",

            "customer_type", "logged_in_at",

        ]



    def get_logged_in_at(self, obj):

        session = (

            UserSession.objects

            .filter(user=obj.user, logged_out_at__isnull=True)

            .order_by("-logged_in_at")

            .first()

        )

        return session.logged_in_at if session else None



    def get_customer_type(self, obj):

        if obj.user.is_staff:

            return "Employee"

        return obj.customer_type.type_name if obj.customer_type else ""



    def get_customer_name(self, obj):

        return "" if obj.user.is_staff else obj.customer_name



    def get_phone_number(self, obj):

        return "" if obj.user.is_staff else obj.phone_number



    def get_address(self, obj):

        return "" if obj.user.is_staff else obj.customer_address

class UserCustomerDiscountRowSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id")
    status = serializers.BooleanField(source="user.is_active")
    is_staff = serializers.BooleanField(source="user.is_staff")
    customer_name = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    customer_type = serializers.SerializerMethodField()
    discount_groups = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "user_id", "status", "is_staff",
            "customer_name", "phone_number",
            "customer_type", "discount_groups"
        ]

    def get_discount_groups(self, obj):
        # 1. Fetch the relationship records for this specific customer
        # 2. Use select_related to join the DiscountGroup table for efficiency
        assignments = CustomerDiscountGroup.objects.filter(customer=obj).select_related('discount_group')
        
        # 3. Extract the 'name' field from the related DiscountGroup model
        return [item.discount_group.name for item in assignments]
    
    def get_logged_in_at(self, obj):
        session = (
            UserSession.objects
            .filter(user=obj.user, logged_out_at__isnull=True)
            .order_by("-logged_in_at")
            .first()
        )
        return session.logged_in_at if session else None

    def get_customer_type(self, obj):
        if obj.user.is_staff:
            return "Employee"
        return obj.customer_type.type_name if obj.customer_type else ""

    def get_customer_name(self, obj):
        return "" if obj.user.is_staff else obj.customer_name

    def get_phone_number(self, obj):
        return "" if obj.user.is_staff else obj.phone_number

class ProductSerializer(serializers.ModelSerializer):

    class Meta:
        model = Product
        # Removed 'product_code' from here entirely
        fields = [
            'id', 'product_name', 'category', 'sub_category', 
            'brand', 'current_stock', 'unit', 'price', 'material', 'size', 
            'product_description', 'capacity', 'warranty', 'max_head'
        ]
        extra_kwargs = {
            'current_stock': {'required': False},
            'product_description': {'required': False, 'allow_blank': True},
            'capacity': {'required': False, 'allow_blank': True},
            'warranty': {'required': False, 'allow_blank': True},
            'material': {'required': False, 'allow_null': True},
        }

    def to_representation(self, instance):
        """
        Transforms the output so React gets clear objects instead of just IDs.
        """
        rep = super().to_representation(instance)
        
        # Handle Category (sent as "1" - Primary Key)
        if instance.category:
            rep['category'] = {"id": instance.category.id, "name": instance.category.category}
        
        # Handle Sub-Category (sent as "Taps" - Slug)
        if instance.sub_category:
            rep['sub_category'] = {"id": instance.sub_category.id, "name": instance.sub_category.sub_category}
            
        # Handle Brand (sent as "Mosco" - Slug)
        if instance.brand:
            rep['brand'] = {"id": instance.brand.id, "name": instance.brand.brand}
            
        # Handle Unit (sent as "1" - Primary Key)
        if instance.unit:
            rep['unit'] = {"id": instance.unit.id, "name": instance.unit.name}

        return rep

class UserConsumerRowSerializer(serializers.ModelSerializer):
    userGroup = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 
            'customer_name', 
            'email', 
            'phone_number',
            'userGroup', 
            'customer_address',
        ]

    def get_email(self, obj):
        """Get email from related User"""
        return obj.user.email if obj.user else None

    def get_userGroup(self, obj):
        try:
            # Safer check using getattr or checking for existence
            if obj.customer_type and obj.customer_type.type_name == "Employee":
                return "Consumers"
        except AttributeError:
            pass
        return ""

class ProductUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductUnit
        fields = ['id', 'name']

class ProductMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductMaterial
        fields = ['id', 'name']

class DiscountGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DiscountGroup
        fields = ['disc_id', 'name', 'base_percent']

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'category']
        # Or use '__all__' to include all fields

class ProductListSerializer(serializers.ModelSerializer):
    category_id    = serializers.IntegerField(source='category.id')
    sub_category_id = serializers.IntegerField(source='sub_category.id')
    brand_id       = serializers.IntegerField(source='brand.id')
    category_name  = serializers.CharField(source='category.category')
    sub_category_name = serializers.CharField(source='sub_category.sub_category')
    brand_name     = serializers.CharField(source='brand.brand')
    class Meta:
        model = Product
        fields = [
            'id',
            'product_name',
            'category_id', 
            'category_name',
            'sub_category_id', 
            'sub_category_name',
            'brand_id', 
            'brand_name',
            'price',
            'current_stock',
            'is_active',
            'unit',         # ID
            'material',     # ID
            'product_description',
            'size',
            'capacity',
            'warranty',
            'max_head'
        ]

# ==================== Hashing data using SHA view ====================

def hash_string_view(input_string):
    """Return the SHA-256 hash as a string (not a Response)"""
    return hashlib.sha256(input_string.encode()).hexdigest()

# ==================== Hashing data using HMAC view ====================

def hmac_hash_string_view(input_string):
    """Return the HMAC-SHA256 hash as a string (not a Response)"""
    secret_key = settings.DJANGO_SECRET_KEY.encode()
    return hmac.new(secret_key, input_string.encode(), hashlib.sha256).hexdigest()

# ==================== ENCRYPT AND DECRYPT FUNCTIONS OF Cryptography ====================

def encrypt_user_id(user_id):
    """Turns '123' into 'gAAAAAB...'"""
    return cipher_suite.encrypt(str(user_id).encode()).decode()

def decrypt_user_id(encrypted_text):
    """Turns 'gAAAAAB...' back into '123'"""
    try:
        return cipher_suite.decrypt(encrypted_text.encode()).decode()
    except Exception:
        return None # Return None if someone tampered with the text

# ==================== AUTHENTICATION VIEWS ====================

class SessionLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {"detail": "Username and password required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {"detail": "Account is disabled"},
                status=status.HTTP_403_FORBIDDEN
            )

        device_hash = get_device_fingerprint(request)

        # Check if already logged in
        existing_session = UserSession.objects.filter(user=user).first()

        # If user has sessions, check if device_hash matches
        if existing_session:
            if existing_session.device_fingerprint != device_hash:
                return Response(
                    {"detail": "Login from a new device is not allowed. Please contact support."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Use the existing device_fingerprint or create new one
        device_fingerprint_to_use = existing_session.device_fingerprint if existing_session else device_hash

        device_record = UserSession.objects.filter(
            user=user,
            device_fingerprint=device_fingerprint_to_use,
            logged_out_at__isnull=True
        ).first()

        if device_record:
            return Response(
                {"detail": "User already logged in on this device."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create Django session
        login(request, user)

        if not request.session.session_key:
            request.session.save()

        user_id_str = str(user.id)
        sha_hashed_id = hash_string_view(user_id_str)  # Get SHA hash
        HMAC_Hashed_Id = hmac_hash_string_view(sha_hashed_id)
        
        current_session_key = request.session.session_key
        cryptography_id = encrypt_user_id(user.id)  # Encrypt the user ID for secure storage
        UserSession.objects.update_or_create(
            user=user,
            defaults={
                'session_key': current_session_key,
                'logged_in_at': timezone.now(),
                'device_fingerprint': device_fingerprint_to_use,
                'logged_out_at': None, # Reset logout if re-logging
                'hashed_user_id': HMAC_Hashed_Id,
                
            }
        )

        # Store role in encrypted session
        user_role = get_user_role(user)
        request.session['user_role'] = user_role
        request.session['user_id'] = user.id
        request.session['username'] = user.username
        request.session['verified_at'] = timezone.now().isoformat()  # ← CRITICAL!
        request.session['last_activity'] = timezone.now().isoformat()


        session_hash = hashlib.sha256(
            f"{user.id}{user_role}{request.session.session_key}".encode()
        ).hexdigest()
        request.session['session_hash'] = session_hash

        return Response({
            "success": True,
            "user_id": cryptography_id,
            "data": HMAC_Hashed_Id,
        }, status=status.HTTP_200_OK)

class GetUserInfoView(APIView):
    """
    Get user info - returns 401 (not 403) when session expires
    """ 
    permission_classes = [AllowAny]
    
    def get(self, request):
        return self._get_user_info(request)
    
    def post(self, request):
        return self._get_user_info(request, verify_client_id=True)
    
    def _get_user_info(self, request, verify_client_id=False):
        # Check if authenticated
        if not request.user.is_authenticated:
            if verify_client_id:
                client_user_id=request.data.get('client_user_id', '') 
                
                if client_user_id:
                    try:
                        user_id = decrypt_user_id(client_user_id) if client_user_id else None  # Accessing this just to trigger any potential tampering issues
                    except: 
                        user_id = None
                    session_count = UserSession.objects.filter(
                        device_fingerprint=get_device_fingerprint(request),
                    ).filter(
                        Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                    ).count()

                    if session_count==1:
                        session_user = UserSession.objects.filter(
                            device_fingerprint=get_device_fingerprint(request),
                            user_id=user_id,
                        ).filter(
                            Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                        ).first()
                        if session_user:
                            print(f"✅ Tampering check passed: Valid session found for this device and user_id")
                            response_data = {"authenticated": False, "tampered": False,"detail": "Session expired"}
                            return Response(
                                response_data,
                                status=status.HTTP_401_UNAUTHORIZED  # ⬅️ 401, not 403
                            )

        real_user_id = request.user.id
        
        print(f"\n📋 USER INFO - User: {request.user.username} (ID: {real_user_id})")
        
        # Session expiry
        try:
            expiry_age = request.session.get_expiry_age()
            expiry_date = timezone.now() + timezone.timedelta(seconds=expiry_age)
            print(f"   Session expires in: {expiry_age} seconds")
        except:
            expiry_age = 0
            expiry_date = timezone.now()
        
        response_data = {
            "authenticated": True,
            "user_id": real_user_id,
            "session_expiry": expiry_date.isoformat(),
            "session_expiry_age": expiry_age,
            "user_role": request.session.get('user_role', 'Unknown'),
        }
        
        # Check tampering if POST
        if verify_client_id:
            client_user_id = request.data.get('client_user_id', '')
            try:
                client_user_id = decrypt_user_id(client_user_id) if client_user_id else None
            except:
                client_user_id = None
            
            if client_user_id and str(client_user_id) != str(real_user_id):
                print(f"⚠️ Tampering: client={client_user_id}, real={real_user_id}")
                response_data["tampered"] = True
                response_data["restore_user_id"] = encrypt_user_id(real_user_id)  # Send encrypted real user ID for potential restoration
        
        return Response(response_data)
    
class GetActualUserRoleView(APIView):
    """
    Get the actual user role from CustomerType
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        actual_role = get_actual_user_role(user)
        return Response({
            "actual_user_role": actual_role
        })

@method_decorator(csrf_exempt, name='dispatch')
class SessionLogoutView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        print(f"\n{'='*60}")
        print(f"🔓 LOGOUT REQUEST")
        print(f"{'='*60}")
        print(f"IP: {request.META.get('REMOTE_ADDR')}")

        if request.content_type == "text/plain;charset=UTF-8":
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.data
        
        user_id = None
        username = "Unknown"
        tampering_detected = False
        body_user_id = None
        user_id_data = data.get('user_id_data', '')  # This is actually the encrypted user_id from the client
        try:
            decrypt_user_id_value = decrypt_user_id(user_id_data) if user_id_data else None
        except:
            decrypt_user_id_value = None
        encrypt_user_data = data.get('encrypted_data', '')  # This is the encrypted user_id from the client

        # ⬇️ METHOD 1: Get from authenticated session (most reliable)
        if request.user.is_authenticated:
            user_id = request.user.id
            username = request.user.username
            print(f"✅ From authenticated session: {username} (ID: {user_id})")
        
        # ⬇️ METHOD 2: Get from expired session cookie (if not authenticated)
        elif request.COOKIES.get('sessionid'):
            try:
                from django.contrib.sessions.models import Session
                session_key = request.COOKIES.get('sessionid')
                print(f"🔍 Trying session key: {session_key[:16]}...")
                
                session = Session.objects.get(session_key=session_key)
                session_data = session.get_decoded()
                extracted_user_id = session_data.get('_auth_user_id')
                
                if extracted_user_id:
                    # Verify the user exists in DB (anti-tampering)
                    User = get_user_model()
                    user = User.objects.get(id=extracted_user_id)
                    user_id = user.id
                    username = user.username
                    print(f"✅ From expired session: {username} (ID: {user_id})")
                else:
                    tampering_detected = True
                    print(f"⚠️ Tampered session: No _auth_user_id in session data")
            except Session.DoesNotExist:
                tampering_detected = True
                print(f"⚠️ Tampered session: Invalid session_key")
            except User.DoesNotExist:
                tampering_detected = True
                print(f"⚠️ Tampered session: user_id {extracted_user_id} not in DB")
        
        # ⬇️ METHOD 3: Get from request body (least trusted, for fallback)
        User = get_user_model()
        if not user_id:
            if encrypt_user_data:
                try:
                    # Validate: Ensure it's an integer and user exists
                    session_user  = UserSession.objects.filter(
                                    hashed_user_id=encrypt_user_data,
                                    device_fingerprint=get_device_fingerprint(request),
                                ).filter(
                                    Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                                ).first()

                    if not session_user:
                        # ❌ No match → silent exit (tampering or already logged out)
                        return Response({
                        "success": False,
                        "message": "Log out unsuccessful, no valid user-id found (possible tampering)",
                        }, status=status.HTTP_200_OK)
                    body_user_id = session_user.user_id
                    auth_user = User.objects.filter(id=body_user_id).first()
                    if not auth_user:
                        # Very rare but possible → treat as tampering
                        return Response({
                            "success": False,
                            "message": "User account not found.",
                        }, status=status.HTTP_200_OK)
                    user_id = auth_user.id
                    username = auth_user.username
                    
                    auth_user.is_active = False
                    auth_user.save(update_fields=["is_active"])

                    print(f"✅ User logged out & deactivated: {auth_user.username} (ID: {auth_user.id})")
                except (ValueError, User.DoesNotExist):
                    tampering_detected = True
                    print(f"⚠️ Tampered body: Invalid or non-existent user_id {body_user_id}")
            elif decrypt_user_id_value:
                try:                    
                    session_user  = UserSession.objects.filter(
                                        user_id=decrypt_user_id_value,
                                        device_fingerprint=get_device_fingerprint(request),
                                    ).filter(
                                        Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                                    ).first()
                    
                    if not session_user:
                        # ❌ No match → silent exit (tampering or already logged out)
                        return Response({
                        "success": False,
                        "message": "Log out unsuccessful, no valid user-id found (possible tampering)",
                        }, status=status.HTTP_200_OK)
                    body_user_id = session_user.user_id
                    auth_user = User.objects.filter(id=body_user_id).first()
                    if not auth_user:
                        return Response({
                            "success": False,
                            "message": "User account not found.",
                        }, status=status.HTTP_200_OK)
                    user_id = auth_user.id
                    username = auth_user.username
                    
                    auth_user.is_active = False
                    auth_user.save(update_fields=["is_active"])

                    print(f"✅ User logged out & deactivated: {auth_user.username} (ID: {auth_user.id})")
                except (ValueError, User.DoesNotExist):
                    tampering_detected = True
                    print(f"⚠️ Tampered body: Invalid or non-existent user_id {decrypt_user_id_value}")
            else:
                body_user_id = None
                print(f"ℹ️ No user_id in request body")
        
        # ⬇️ Log tampering for monitoring
        if tampering_detected:
            print(f"🚨 Tampering detected - proceeding with logout anyway")
        if not user_id:
            return Response({
                "success": False,
                "message": "Logout processed, but no valid session found.",
            }, status=status.HTTP_200_OK)

            # Optional: Log to a security table or send alert
        
        # ⬇️ Update UserSession if we have a valid user_id
        if user_id:
            if body_user_id==None:
                if encrypt_user_data:
                    session_user =  UserSession.objects.filter(
                                        device_fingerprint=get_device_fingerprint(request),
                                        hashed_user_id=encrypt_user_data,
                                    ).filter(
                                        Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                                    ).first()
                elif decrypt_user_id_value:
                    session_user =  UserSession.objects.filter(
                                        device_fingerprint=get_device_fingerprint(request),
                                        user_id=decrypt_user_id_value,
                                    ).filter(
                                        Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
                                    ).first()

            device_hash = get_device_fingerprint(request)
            print(f"🔑 Device: {device_hash[:16]}...")

            updated_count = UserSession.objects.filter(
                user_id=user_id,
                device_fingerprint=device_hash
            ).filter(
                Q(logged_out_at__isnull=True) | Q(logged_out_at__lt=F('logged_in_at'))
            ).update(
                logged_out_at=timezone.now()
            )
            
            if updated_count > 0:
                print(f"✅ Successfully updated {updated_count} session record(s).")
            else:
                print("ℹ️ No update needed: Session already logged out.")

        else:
            print(f"⚠️ No valid user_id found - UserSession not updated (logout still succeeds)")
        
        # ⬇️ Always perform logout/flush
        if request.user.is_authenticated:
            logout(request)
            print(f"🧹 Django logout() called")
        else:
            request.session.flush()
            print(f"🧹 Session flushed")
        
        print(f"✅ Logout complete")
        print(f"{'='*60}\n")

        if (session_user.user_id != user_id) | (session_user==None) | (encrypt_user_data ==None):
                print(f"⚠️ Tampering: Encrypted user data in body does not match any active session for this device, deactivating account as precaution")
                User = get_user_model()
                auth_user = User.objects.filter(id=user_id).first()
                if auth_user:
                    auth_user.is_active = False
                    auth_user.save(update_fields=["is_active"])
                    print(f"✅ User account deactivated due to suspected tampering: {auth_user.username} (ID: {auth_user.id})")
                return Response({
                    "success": True,
                    "message": "Tampering detected: Encrypted data in body does not match any active session for this device",
                }, status=status.HTTP_200_OK)
        
        return Response({
            "success": True,
            "message": "Logged out successfully",
        }, status=status.HTTP_200_OK)

class ExtendSessionView(APIView):
    """
    Lightweight endpoint to extend session
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Just accessing request.user extends the session
        # if SESSION_SAVE_EVERY_REQUEST = True
        
        expiry_age = request.session.get_expiry_age()
        
        return Response({
            "success": True,
            "session_extended": True,
            "expires_in": expiry_age,
        })
            
@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFTokenView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        return Response({
            "success": True,
            "message": "CSRF token issued"
        }, status=status.HTTP_200_OK)

# ==================== USER MANAGEMENT VIEWS ====================

class UserRegistrationView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAuthenticated()]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            user = serializer.instance
            if not user.is_active:
                try:
                    customer = Customer.objects.get(user=user)

                    # ✅ Notify Owner via SMS
                    try:
                        sid = send_owner_sms_report(
                            # Short & Sweet (Under 160 chars)
                            f"New Reg: {customer.customer_name}\n"
                            f"Ph: {customer.phone_number}\n"
                            f"Type: {customer.customer_type.type_name}\n"
                            f"Check dashboard to approve."
                        )
                        print(f"--- Twilio Success! SID: {sid} ---")
                    except Exception as e:
                        print(f"--- Twilio CRASHED: {str(e)} ---")

                    # ✅ Create a PendingRegistration record
                    PendingRegistration.objects.create(
                        user=user,
                        customer=customer,
                    )

                except Customer.DoesNotExist:
                    pass

                return Response(
                    {"detail": "Registration submitted. Awaiting owner approval."},
                    status=status.HTTP_201_CREATED
                )
            # If active (created by Owner), return standard success
            return Response({"detail": "User created successfully."}, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        user_id = request.data.get("user_id")

        try:
            user = User.objects.get(id=user_id)
            customer = Customer.objects.filter(user=user).first()
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)
        except Customer.DoesNotExist:
            return Response({"detail": "Customer profile not found"}, status=404)

        data = request.data
        errors = {}

        # 1. Individual Uniqueness: Username
        new_username = data.get("username")
        customer_userGroup = data.get("customer_userGroup")
        in_name = data.get("customer_name")
        in_phone = data.get("phone_number")

        if new_username and new_username != user.username:
            if User.objects.exclude(id=user.id).filter(username=new_username).exists():
                errors["username"] = "Username already taken."

        if customer and customer_userGroup != "Employee":
            if in_phone and in_phone != customer.phone_number:
                if Customer.objects.exclude(id=customer.id).filter(phone_number=in_phone).exists():
                    errors["phone_number"] = "Phone number already registered."
        # If any uniqueness check failed, return all errors
        if errors:
            return Response({"success": False, "errors": errors}, status=400)

        # --- Start the update process ---
        try:
            with transaction.atomic():
                # Update User fields
                if new_username: user.username = new_username
                if "email" in data: user.email = data.get("email")
                if "status" in data: user.is_active = data.get("status")
                if data.get("password"): user.set_password(data["password"])

                # 5. Handle Employee vs Customer Branch
                if customer_userGroup == "Employee":
                    user.is_staff = True
                    # Map Employee details directly to User table
                    if in_name: user.first_name = in_name
                    if in_phone: user.last_name = in_phone
                    
                    # Clean up: If they had a customer row, delete it
                    if customer:
                        customer.delete()
                else:
                    user.is_staff = False
                    # Map ShopName to last_name for regular Customers
                    if "shopName" in data:
                        user.last_name = data.get("shopName")

                user.save()


                if customer_userGroup != "Employee":
                    if not customer:
                        # If moving from Employee -> Customer, create the row
                        customer = Customer(user=user)
                    
                    customer.customer_name = in_name if in_name else customer.customer_name
                    customer.phone_number = in_phone if in_phone else customer.phone_number
                    customer.customer_address = data.get("customer_address", customer.customer_address)
                    customer.gst_id = data.get("gst_id", customer.gst_id)

                    if customer_userGroup:
                        try:
                            c_type = CustomerType.objects.get(type_name=customer_userGroup)
                            customer.customer_type = c_type
                        except CustomerType.DoesNotExist:
                            return Response({"detail": "Invalid type"}, status=400)
                    
                    customer.save()
            return Response({"success": True, "detail": "User updated successfully"}, status=200)

        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=500)

class PendingRegistrationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/registrations/pending/ — Owner sees all pending"""
        if not request.user.is_superuser:
            return Response({"error": "Access denied"}, status=403)

        pending = PendingRegistration.objects.filter(
            status='pending'
        ).select_related('user', 'customer', 'customer__customer_type')

        data = []
        for p in pending:
            data.append({
                "id":            p.id,
                "user_id":       p.user.id,
                "username":      p.user.username,
                "email":         p.user.email,
                "customer_name": p.customer.customer_name,
                "phone_number":  p.customer.phone_number,
                "customer_type": p.customer.customer_type.type_name,
                "shop_name":     p.user.last_name,
                "submitted_at":  p.submitted_at.strftime("%d %b %Y, %I:%M %p"),
            })

        return Response({"pending": data, "count": len(data)}, status=200)

class ApproveRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, registration_id):
        """POST /api/registrations/<id>/approve/"""
        if not request.user.is_superuser:
            return Response({"error": "Access denied"}, status=403)

        try:
            pending = PendingRegistration.objects.select_related(
                'user', 'customer', 'customer__customer_type'
            ).get(id=registration_id, status='pending')

            with transaction.atomic():
                # ✅ Activate the user
                pending.user.is_active = True
                pending.user.save()

                # ✅ Update pending record
                pending.status = 'approved'
                pending.reviewed_at = timezone.now()
                pending.review_note = request.data.get('note', '')
                pending.save()

                # ✅ Send approval SMS to customer
                try:
                    send_sms(
                        pending.customer.phone_number,
                        (
                            f"✅ Welcome to Shree Ganesh Traders!\n\n"
                            f"Dear {pending.customer.customer_name},\n"
                            f"Your registration has been approved.\n"
                            f"You can now log in with your username: {pending.user.username}\n\n"
                            f"Thank you for joining us!"
                        )
                    )
                except Exception as e:
                    print(f"SMS to customer failed: {e}")

            return Response({"message": "Registration approved successfully."}, status=200)

        except PendingRegistration.DoesNotExist:
            return Response({"error": "Registration not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class RejectRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, registration_id):
        """POST /api/registrations/<id>/reject/"""
        if not request.user.is_superuser:
            return Response({"error": "Access denied"}, status=403)

        try:
            pending = PendingRegistration.objects.select_related(
                'user', 'customer'
            ).get(id=registration_id, status='pending')

            reason = request.data.get('reason', 'Your registration was not approved.')

            with transaction.atomic():
                # ✅ Send rejection SMS to customer before deleting
                try:
                    send_sms(
                        pending.customer.phone_number,
                        (
                            f"❌ Registration Update — Shree Ganesh Traders\n\n"
                            f"Dear {pending.customer.customer_name},\n"
                            f"Unfortunately your registration request was not approved.\n\n"
                            f"Reason: {reason}\n\n"
                            f"For queries, please contact us directly."
                        )
                    )
                except Exception as e:
                    print(f"SMS to customer failed: {e}")

                # ✅ Update record then delete user
                pending.status = 'rejected'
                pending.reviewed_at = timezone.now()
                pending.review_note = reason
                pending.save()

                # ✅ Delete the user account
                pending.user.delete()  # cascades to Customer too

            return Response({"message": "Registration rejected and user removed."}, status=200)

        except PendingRegistration.DoesNotExist:
            return Response({"error": "Registration not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
          
class UserCustomerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        staff_users = User.objects.filter(is_superuser=False, is_staff=True)
        
        formatted_staff = []
        for user in staff_users:
            staff_session = UserSession.objects.filter(
                user=user,
                logged_out_at__isnull=True
            ).order_by('-logged_in_at').first()

            formatted_staff.append({
            'user_id': user.id,
            'username': user.username,
            'status': user.is_active,
            'email': user.email,
            'is_staff': user.is_staff,
            'customer_name': user.first_name or '',
            'phone_number': user.last_name or '',  # Your code uses '-' here
            'address': '',
            'customer_type': 'Employee',
            'logged_in_at': staff_session.logged_in_at if staff_session else None,
        })

        # 2. Get Customers (EXCLUDE staff users to prevent duplicates)
        customers = (
            Customer.objects
            .select_related("user", "customer_type")
            .exclude(user__is_superuser=True)
            .exclude(user__is_staff=True)
        )
        
        serializer = UserCustomerRowSerializer(customers, many=True)
        
        # 3. Combine
        all_users = serializer.data + formatted_staff
        all_users = sorted(all_users, key=lambda x: x['user_id'])
        return Response(all_users)

class CustomerDiscListView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        search     = request.data.get("search")
        groupname  = request.data.get("groupname")
        page_size  = int(request.data.get("page_size", 10))

        # Per-group page numbers sent as a dict: { "Retailer": 1, "Builder": 2, ... }
        group_pages = request.data.get("group_pages", {})

        # -----------------------
        # EMPLOYEES (CONSUMERS)
        # Only a summary header — no individual rows
        # -----------------------
        staff_count = User.objects.filter(
            is_superuser=False,
            is_staff=True
        ).count()

        consumer_summary = {
            'group_name':     'Consumer',
            'is_consumer':    True,         # Flag for frontend to render header-only
            'count':          staff_count,
            'discount_groups': [],
        }

        # -----------------------
        # BASE CUSTOMERS QUERY
        # -----------------------
        customers = Customer.objects.select_related(
            "user", "customer_type"
        ).prefetch_related(
            "customerdiscountgroup_set__discount_group"
        ).exclude(
            user__is_superuser=True
        ).exclude(
            user__is_staff=True
        )

        # -----------------------
        # SEARCH FILTER
        # -----------------------
        if search:
            customers = customers.filter(
                Q(customer_name__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(customer_type__type_name__icontains=search) |
                Q(customerdiscountgroup__discount_group__name__icontains=search)
            ).distinct()

        # -----------------------
        # DISCOUNT GROUP FILTER
        # -----------------------
        if groupname:
            customers = customers.filter(
                customerdiscountgroup__discount_group_id=groupname
            ).distinct()

        # -----------------------
        # GROUP + PAGINATE PER TYPE
        # -----------------------
        all_types = customers.values_list(
            'customer_type__type_name', flat=True
        ).distinct()

        paginated_groups = []

        for type_name in all_types:
            group_qs    = customers.filter(customer_type__type_name=type_name)
            total       = group_qs.count()
            page        = int(group_pages.get(type_name, 1))
            total_pages = max(1, (total + page_size - 1) // page_size)

            # Clamp page within valid range
            page   = max(1, min(page, total_pages))
            offset = (page - 1) * page_size
            paged  = group_qs[offset: offset + page_size]

            serializer = UserCustomerDiscountRowSerializer(paged, many=True)

            paginated_groups.append({
                'group_name':  type_name,
                'total':       total,
                'page':        page,
                'total_pages': total_pages,
                'page_size':   page_size,
                'customers':   serializer.data,
            })

        # Sort groups alphabetically for consistent order
        paginated_groups = sorted(paginated_groups, key=lambda x: x['group_name'])

        # Consumer header only shown when no group filter is active
        return Response({
            'groups':           paginated_groups,
            'consumer_summary': consumer_summary if not groupname else None,
        })

class BulkDiscountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, type_name):
        """Fetch current discount group assignments for a customer type."""
        try:
            customer_type = CustomerType.objects.get(type_name=type_name)
        except CustomerType.DoesNotExist:
            return Response({'error': f'Customer type "{type_name}" not found.'}, status=404)

        assignments = UserGroupDiscountProfile.objects.filter(
            customer_type=customer_type
        ).select_related('discount_group')

        data = [
            {
                'id':             a.id,                      # ✅ FIX: was a.disc_id — UserGroupDiscountProfile PK is 'id'
                'discount_group': a.discount_group.disc_id,
                'name':           a.discount_group.name,
                'base_percent':   a.discount_group.base_percent,
            }
            for a in assignments
        ]
        return Response(data)

    def post(self, request, type_name):
        try:
            customer_type = CustomerType.objects.get(type_name=type_name)
        except CustomerType.DoesNotExist:
            return Response({'error': f'Customer type "{type_name}" not found.'}, status=404)

        discount_group_ids = request.data.get('discount_groups', [])

        # Validate all disc_ids exist
        valid_ids = set(
            DiscountGroup.objects.filter(
                disc_id__in=discount_group_ids
            ).values_list('disc_id', flat=True)
        )
        invalid = [i for i in discount_group_ids if i not in valid_ids]
        if invalid:
            return Response({'error': f'Invalid discount group IDs: {invalid}'}, status=400)

        # ── OVERLAP VALIDATION ────────────────────────────────────────────────────
        # Build category/subcategory/brand sets per group
        # A conflict exists if two selected groups share the same
        # (category_id, sub_category_id, brand_id) triple — meaning they'd
        # apply to the exact same products.

        if len(discount_group_ids) > 1:
            # Build lookup: { disc_id: set of (cat_id, sub_id, brand_id) }
            group_coverage = {}

            for gid in discount_group_ids:
                cat_ids   = set(DiscountGroupCategoryMap.objects.filter(group_id=gid).values_list('category_id', flat=True))
                sub_ids   = set(DiscountGroupSubCategoryMap.objects.filter(group_id=gid).values_list('sub_category_id', flat=True))
                brand_ids = set(DiscountGroupBrandMap.objects.filter(group_id=gid).values_list('brand_id', flat=True))

                # All combinations this group covers
                triples = set()
                for cat in cat_ids:
                    for sub in sub_ids:
                        for brand in brand_ids:
                            triples.add((cat, sub, brand))

                group_coverage[gid] = triples

            # Check every pair of selected groups for overlapping triples
            group_ids_list = list(discount_group_ids)
            conflicts = []

            for i in range(len(group_ids_list)):
                for j in range(i + 1, len(group_ids_list)):
                    gid_a = group_ids_list[i]
                    gid_b = group_ids_list[j]
                    overlap = group_coverage[gid_a] & group_coverage[gid_b]  # set intersection

                    if overlap:
                        name_a = DiscountGroup.objects.get(disc_id=gid_a).name
                        name_b = DiscountGroup.objects.get(disc_id=gid_b).name
                        conflicts.append(
                            f"'{name_a}' and '{name_b}' both cover the same category/subcategory/brand combination."
                        )

            if conflicts:
                return Response({
                    'success': False,
                    'error':   'Overlapping discount groups detected. Each product combination can only be covered by one discount group.',
                    'conflicts': conflicts
                }, status=400)

        # ── END OVERLAP VALIDATION ────────────────────────────────────────────────

        with transaction.atomic():

            old_bulk_group_ids = list(
                UserGroupDiscountProfile.objects.filter(
                    customer_type=customer_type
                ).values_list('discount_group_id', flat=True)
            )

            UserGroupDiscountProfile.objects.filter(
                customer_type=customer_type
            ).delete()

            UserGroupDiscountProfile.objects.bulk_create([
                UserGroupDiscountProfile(
                    customer_type=customer_type,
                    discount_group_id=gid
                )
                for gid in discount_group_ids
            ])

            IS_EMPLOYEE_TYPE = type_name.lower() in ('employee')
            cascaded_to = 0

            if not IS_EMPLOYEE_TYPE:
                customer_ids = list(
                    Customer.objects.filter(
                        customer_type=customer_type
                    ).values_list('id', flat=True)
                )

                if old_bulk_group_ids:
                    CustomerDiscountGroup.objects.filter(
                        customer_id__in=customer_ids,
                        discount_group_id__in=old_bulk_group_ids
                    ).delete()

                new_rows = [
                    CustomerDiscountGroup(
                        customer_id=cid,
                        discount_group_id=gid
                    )
                    for cid in customer_ids
                    for gid in discount_group_ids
                ]
                if new_rows:
                    CustomerDiscountGroup.objects.bulk_create(
                        new_rows,
                        ignore_conflicts=True
                    )

                cascaded_to = len(customer_ids)

        return Response({
            'success':     True,
            'assigned':    len(discount_group_ids),
            'cascaded_to': cascaded_to,
            'note': (
                'Bulk discount saved at group level only (Employee/Consumer).'
                if IS_EMPLOYEE_TYPE
                else f'Discount cascaded to {cascaded_to} individual {type_name}s.'
            )
        })

@csrf_exempt
def manage_attribute(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid method"}, status=405)

    try:
        data        = json.loads(request.body)
        attr_type   = data.get("type")           # category | subcategory | brand
        action      = data.get("action")          # add | replace
        name        = data.get("name")            # New name for 'add'
        source_id   = data.get("id")              # The ID to be replaced/removed
        target_id   = data.get("target_id")       # The ID to move everything TO
        category_id = data.get("category_id")     # Parent category for subcat add

        if not attr_type or not action:
            return JsonResponse({"error": "Missing type or action"}, status=400)

        with transaction.atomic():

            # =========================
            # CATEGORY LOGIC
            # =========================
            if attr_type == "category":
                if action == "add":
                    ProductCategory.objects.get_or_create(category=name)
                    return JsonResponse({"message": "Category added"})

                elif action == "replace":
                    # Move all subcategories and products to target category
                    ProductSubCategory.objects.filter(category_id=source_id).update(category_id=target_id)
                    Product.objects.filter(category_id=source_id).update(category_id=target_id)

                    # Migrate discount group maps — check for duplicates before moving
                    for s_map in DiscountGroupCategoryMap.objects.filter(category_id=source_id):
                        if DiscountGroupCategoryMap.objects.filter(
                            group_id=s_map.group_id,
                            category_id=target_id
                        ).exists():
                            s_map.delete()  # duplicate — drop the source mapping
                        else:
                            s_map.category_id = target_id
                            s_map.save()

                    # ✅ FIX: .filter().delete() instead of .get().delete()
                    ProductCategory.objects.filter(id=source_id).delete()
                    return JsonResponse({"message": "Category merged and deleted"})

            # =========================
            # SUBCATEGORY LOGIC
            # =========================
            elif attr_type == "subcategory":
                if action == "add":
                    category = ProductCategory.objects.get(id=category_id)
                    # ✅ FIX: get_or_create to avoid IntegrityError on duplicates
                    ProductSubCategory.objects.get_or_create(sub_category=name, category=category)
                    return JsonResponse({"message": "Subcategory added"})

                elif action == "replace":
                    # Move all products to target subcategory
                    Product.objects.filter(sub_category_id=source_id).update(sub_category_id=target_id)

                    # ✅ FIX: was incorrectly using category_id=target_id (wrong field)
                    # Now uses loop to handle unique_together on BrandSubCategoryMap
                    for b_map in BrandSubCategoryMap.objects.filter(sub_category_id=source_id):
                        if BrandSubCategoryMap.objects.filter(
                            brand_id=b_map.brand_id,
                            sub_category_id=target_id
                        ).exists():
                            b_map.delete()  # duplicate — drop the source mapping
                        else:
                            b_map.sub_category_id = target_id
                            b_map.save()

                    # Migrate discount group maps — check for duplicates before moving
                    for s_map in DiscountGroupSubCategoryMap.objects.filter(sub_category_id=source_id):
                        if DiscountGroupSubCategoryMap.objects.filter(
                            group_id=s_map.group_id,
                            sub_category_id=target_id
                        ).exists():
                            s_map.delete()  # duplicate — drop the source mapping
                        else:
                            s_map.sub_category_id = target_id
                            s_map.save()

                    # ✅ FIX: .filter().delete() instead of .get().delete()
                    ProductSubCategory.objects.filter(id=source_id).delete()
                    return JsonResponse({"message": "Subcategory merged"})

            # =========================
            # BRAND LOGIC
            # =========================
            elif attr_type == "brand":
                if action == "add":
                    ProductBrand.objects.get_or_create(brand=name)
                    return JsonResponse({"message": "Brand added"})

                elif action == "replace":
                    # Move all products to target brand
                    Product.objects.filter(brand_id=source_id).update(brand_id=target_id)

                    # ✅ FIX: was using bulk .update() which causes IntegrityError
                    # on unique_together — now uses loop with duplicate check
                    for bs_map in BrandSubCategoryMap.objects.filter(brand_id=source_id):
                        if BrandSubCategoryMap.objects.filter(
                            brand_id=target_id,
                            sub_category_id=bs_map.sub_category_id
                        ).exists():
                            bs_map.delete()  # duplicate — drop the source mapping
                        else:
                            bs_map.brand_id = target_id
                            bs_map.save()

                    # Migrate discount group maps — check for duplicates before moving
                    for d_map in DiscountGroupBrandMap.objects.filter(brand_id=source_id):
                        if DiscountGroupBrandMap.objects.filter(
                            group_id=d_map.group_id,
                            brand_id=target_id
                        ).exists():
                            d_map.delete()  # duplicate — drop the source mapping
                        else:
                            d_map.brand_id = target_id
                            d_map.save()

                    # ✅ FIX: .filter().delete() instead of .get().delete()
                    ProductBrand.objects.filter(id=source_id).delete()
                    return JsonResponse({"message": "Brand merged"})

        return JsonResponse({"error": "Invalid configuration"}, status=400)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
class ReassignAttributeView(APIView):
    """
    POST /api/reassign-attribute/

    1. subcategory → category  (updates FK on ProductSubCategory)
       Body: { "type": "subcategory", "id": <subcategory_id>, "target_id": <new_category_id> }

    2. brand → subcategories  (replaces all BrandSubCategoryMap rows for brand)
       Body: { "type": "brand", "id": <brand_id>, "target_ids": [<sub_id>, <sub_id>, ...] }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_type  = request.data.get("type")
        item_id    = request.data.get("id")
        target_id  = request.data.get("target_id")   # used by subcategory
        target_ids = request.data.get("target_ids")  # used by brand (list)

        if not item_type or not item_id:
            return Response(
                {"success": False, "error": "type and id are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if item_type not in ("subcategory", "brand"):
            return Response(
                {"success": False, "error": "type must be 'subcategory' or 'brand'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── subcategory → category ────────────────────────────────────────────
        if item_type == "subcategory":
            if not target_id:
                return Response(
                    {"success": False, "error": "target_id is required for subcategory reassignment."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                sub = ProductSubCategory.objects.get(id=item_id)
            except ProductSubCategory.DoesNotExist:
                return Response({"success": False, "error": f"Subcategory {item_id} not found."}, status=404)

            try:
                new_cat = ProductCategory.objects.get(id=target_id)
            except ProductCategory.DoesNotExist:
                return Response({"success": False, "error": f"Category {target_id} not found."}, status=404)

            if sub.category_id == new_cat.id:
                return Response({"success": False, "error": "Subcategory already belongs to this category."}, status=400)

            old_name = sub.category.category
            sub.category = new_cat
            sub.save(update_fields=["category"])

            return Response({
                "success": True,
                "message": f"'{sub.sub_category}' reassigned from '{old_name}' → '{new_cat.category}'."
            })

        # ── brand → subcategories (multi) ─────────────────────────────────────
        # ── brand → subcategories (one-to-many) ──────────────────────────────────────
        # Relationship name: "Brand Subcategory Ownership"
        # Rule: One subcategory can be owned by only one brand.
        #       One brand can own many subcategories.
        #       If a subcategory is already owned by another brand, auto-reassign it.

        if item_type == "brand":
            if not target_ids or not isinstance(target_ids, list) or len(target_ids) == 0:
                return Response(
                    {"success": False, "error": "target_ids must be a non-empty list of subcategory IDs."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                brand = ProductBrand.objects.get(id=item_id)
            except ProductBrand.DoesNotExist:
                return Response({"success": False, "error": f"Brand {item_id} not found."}, status=404)

            # Validate all target subcategory IDs exist
            valid_subs = list(ProductSubCategory.objects.filter(id__in=target_ids))
            if len(valid_subs) != len(target_ids):
                found_ids = {s.id for s in valid_subs}
                missing   = [i for i in target_ids if i not in found_ids]
                return Response(
                    {"success": False, "error": f"Subcategory ID(s) not found: {missing}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Step 1: Remove all existing subcategory mappings for THIS brand
                BrandSubCategoryMap.objects.filter(brand=brand).delete()

                # Step 2: For each target subcategory, delete any existing mapping
                # to a DIFFERENT brand (auto-reassign — enforces one-subcategory-one-brand)
                BrandSubCategoryMap.objects.filter(
                    sub_category__in=valid_subs
                ).exclude(brand=brand).delete()

                # Step 3: Create fresh mappings for this brand
                BrandSubCategoryMap.objects.bulk_create([
                    BrandSubCategoryMap(brand=brand, sub_category=sub)
                    for sub in valid_subs
                ])

            sub_names = ", ".join(s.sub_category for s in valid_subs)
            return Response({
                "success": True,
                "message": f"'{brand.brand}' now owns {len(valid_subs)} subcategorie(s): {sub_names}."
            })

class UserConsumerListView(APIView):  # ⬅️ Fixed class name (capital U)
    permission_classes = [IsAuthenticated]

    def post(self, request):
        print(f"\n{'='*60}")
        print(f"📋 USER CONSUMER LIST REQUEST")
        print(f"{'='*60}")
        print(f"User: {request.user.username}")
        print(f"Request data: {request.data}")
        
        # ⬇️ Get emp_id from request
        emp_id = request.data.get('userId')
        
        print(f"Employee ID: {emp_id}")
        
        # ⬇️ Validate emp_id
        if not emp_id:
            print("❌ Missing userId in request")
            return Response(
                {"detail": "userId is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # ⬇️ Query customers (adjust field name based on your model)
            # Option 1: If Customer has user_id field
            customers = Customer.objects.filter(user__id=emp_id)
            
            # Option 2: If Customer has user ForeignKey
            # customers = Customer.objects.filter(user__id=emp_id)
            
            # Option 3: If Customer has assigned_employee field
            # customers = Customer.objects.filter(assigned_employee_id=emp_id)
            
            print(f"✅ Found {customers.count()} customers")
            
            # ⬇️ Serialize
            serializer = UserConsumerRowSerializer(customers, many=True)
            
            print(f"✅ Returning {len(serializer.data)} serialized customers")
            print(f"{'='*60}\n")
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error: {type(e).__name__}: {e}")
            import traceback
            print(traceback.format_exc())
            print(f"{'='*60}\n")
            
            return Response(
                {"detail": f"Server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserMasterDataView(APIView):
    permission_classes = [IsAuthenticated]

class Get_Form_Options(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retrieve all static form options in a single call:
        - Categories
        - Units
        - Materials
        - Discount Groups
        """
        print(f"\n{'='*60}")
        print(f"📋 GET FORM OPTIONS REQUEST")
        print(f"{'='*60}")
        print(f"User: {request.user.username}")

        try:
            # Fetch all reference data
            categories      = ProductCategory.objects.all().order_by('category')
            units           = ProductUnit.objects.all().order_by('name')
            materials       = ProductMaterial.objects.all().order_by('name')
            discount_groups = DiscountGroup.objects.all().order_by('name')

            print(f"✅ Categories     : {categories.count()}")
            print(f"✅ Units          : {units.count()}")
            print(f"✅ Materials      : {materials.count()}")
            print(f"✅ Discount Groups: {discount_groups.count()}")

            # Serialize each queryset
            categories_data      = ProductCategorySerializer(categories, many=True).data
            units_data           = ProductUnitSerializer(units, many=True).data
            materials_data       = ProductMaterialSerializer(materials, many=True).data
            discount_groups_data = DiscountGroupSerializer(discount_groups, many=True).data

            print(f"✅ Serialization complete")
            print(f"{'='*60}\n")

            return Response({
                "success": True,
                "data": {
                    "categories":      categories_data,
                    "units":           units_data,
                    "materials":       materials_data,
                    "discount_groups": discount_groups_data,
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Error: {type(e).__name__}: {e}")
            import traceback
            print(traceback.format_exc())
            print(f"{'='*60}\n")

            return Response({
                "success": False,
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ToggleUserStatusView(APIView):
    """Toggle user active/inactive status"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        print(f"\n{'='*60}")
        print(f"🔄 TOGGLE USER STATUS")
        print(f"{'='*60}")
        
        # Get the new status from request
        is_active = request.data.get('is_active')
        user_id = request.data.get('user_id')

        print(f"Requester: {request.user.username} (ID: {request.user.id})")
        print(f"Target user ID: {user_id}")
        print(f"Requested new status: {is_active}")
        
        # ⬇️ Permission check: Only owners can toggle status
        if not request.user.is_superuser:
            print(f"❌ Permission denied - user is not owner")
            print(f"{'='*60}\n")
            return Response(
                {"detail": "Only owners can change user status"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Get the user model
            User = get_user_model()
            target_user = User.objects.get(id=user_id)
            
            print(f"Target user: {target_user.username}")
            print(f"Current status: {target_user.is_active}")
            
            # ⬇️ Prevent deactivating yourself
            if target_user.id == request.user.id:
                print(f"❌ Cannot deactivate yourself")
                print(f"{'='*60}\n")
                return Response(
                    {"detail": "You cannot deactivate your own account"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update the status
            old_status = target_user.is_active
            target_user.is_active = is_active
            target_user.save(update_fields=['is_active'])
            
            print(f"✅ User status updated: {old_status} → {is_active}")
            print(f"{'='*60}\n")
            
            return Response({
                "success": True,
                "user_id": user_id,
                "is_active": is_active,
                "message": f"User {'activated' if is_active else 'deactivated'} successfully",
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            print(f"❌ User {user_id} not found")
            print(f"{'='*60}\n")
            return Response(
                {"detail": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Error: {type(e).__name__}: {e}")
            import traceback
            print(traceback.format_exc())
            print(f"{'='*60}\n")
            return Response(
                {"detail": f"Server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class Get_Categories(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Retrieve all product categories
        """
        print(f"\n{'='*60}")
        print(f"📂 GET CATEGORIES REQUEST")
        print(f"{'='*60}")
        print(f"User: {request.user.username}")
        
        try:
            # Get all categories
            categories = ProductCategory.objects.all().order_by('category')
            
            print(f"✅ Found {categories.count()} categories")
            
            # Serialize the data
            serializer = ProductCategorySerializer(categories, many=True)
            
            print(f"✅ Returning {len(serializer.data)} serialized categories")
            print(f"{'='*60}\n")
            
            return Response({
                "success": True,
                "count": categories.count(),
                "data": serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error: {type(e).__name__}: {e}")
            import traceback
            print(traceback.format_exc())
            print(f"{'='*60}\n")
            
            return Response({
                "success": False,
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class Get_Sub_Categories_By_Categories(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Extract the category ID
        category_id = request.data.get('category')
        
        # 1. If category_id is provided, filter by it.
        # 2. If category_id is None/Empty, get all subcategories.
        if category_id:
            subcategories = ProductSubCategory.objects.filter(category_id=category_id)
        else:
            subcategories = ProductSubCategory.objects.all()

        # Added ordering by name for a better UI experience
        subcategories = subcategories.order_by('sub_category')
        
        # Prepare the data
        data = [
            {'id': sub.id, 'name': sub.sub_category} 
            for sub in subcategories
        ]
        
        return Response(data, status=status.HTTP_200_OK)

class Get_Brands_By_Sub_Categories(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub_category_val = request.data.get('sub_category')
        
        brands_queryset = ProductBrand.objects.all()

        if sub_category_val:
            sub_category_ids = sub_category_val if isinstance(sub_category_val, list) else [sub_category_val]
            brands_queryset = brands_queryset.filter(
                subcategory_mappings__sub_category_id__in=sub_category_ids
            )
        # ✅ No else — if no sub_category, all brands are returned as-is

        data = list(
            brands_queryset.distinct().order_by('brand').values('id', 'brand')
        )

        return Response(
            [{'id': b['id'], 'name': b['brand']} for b in data],
            status=status.HTTP_200_OK
        )
    
class ProductRegistrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data  # No need to copy() if we aren't manually mutating strings
        
        try:
            # 1. Simplified Duplicate Check
            # Use _id suffix to check against the numeric values directly
            exists = Product.objects.filter(
                product_name=data.get('product_name'),
                category_id=data.get('category'),
                sub_category_id=data.get('sub_category'),
                brand_id=data.get('brand')
            ).exists()

            if exists:
                return Response({
                    "success": False, 
                    "error": "This product already exists with these specific details."
                }, status=409)

            # 2. Standard Serializer Logic
            # The Serializer naturally handles numeric IDs for ForeignKeys
            serializer = ProductSerializer(data=data)
            if serializer.is_valid():
                product = serializer.save()
                return Response({
                    "success": True,
                    "message": "Product created successfully",
                    "data": ProductSerializer(product).data
                }, status=201)
            
            return Response({"success": False, "errors": serializer.errors}, status=400)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)
            
    def put(self, request, product_id):
        try:
            product = Product.objects.get(pk=product_id)
            # partial=True is good here; it allows updating just a few fields if needed
            serializer = ProductSerializer(product, data=request.data, partial=True)

            if serializer.is_valid():
                updated_product = serializer.save()
                return Response({
                    "success": True,
                    "message": "Product updated successfully",
                    "data": ProductSerializer(updated_product).data
                }, status=status.HTTP_200_OK)

            return Response({
                "success": False,
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except Product.DoesNotExist:
            return Response({"success": False, "error": "Product not found"}, status=404)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)

class CustomerDiscGrpAddition(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        try:
            # 1. Verify customer exists
            customer = Customer.objects.get(user_id=customer_id)
            
            # 2. Fetch all assignments for this customer
            # We use select_related to get the group details in one query
            assignments = CustomerDiscountGroup.objects.filter(
                customer=customer
            ).select_related('discount_group')

            # 3. Format the data for the frontend
            # The React state 'assignments' expects an object with 'discount_group' (the ID)
            data = [
                {
                    "id": a.id, 
                    "discount_group": a.discount_group.disc_id,
                    "name": a.discount_group.name  # Optional, but helpful for debugging
                } 
                for a in assignments
            ]

            return Response(data, status=status.HTTP_200_OK)

        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def post(self, request, customer_id):
        group_ids = list(set(request.data.get('discount_groups', [])))

        try:
            customer = Customer.objects.get(user_id=customer_id)

            # ── OVERLAP VALIDATION ────────────────────────────────────────────────
            if len(group_ids) > 1:
                group_coverage = {}

                for gid in group_ids:
                    cat_ids   = set(DiscountGroupCategoryMap.objects.filter(group_id=gid).values_list('category_id', flat=True))
                    sub_ids   = set(DiscountGroupSubCategoryMap.objects.filter(group_id=gid).values_list('sub_category_id', flat=True))
                    brand_ids = set(DiscountGroupBrandMap.objects.filter(group_id=gid).values_list('brand_id', flat=True))

                    triples = set()
                    for cat in cat_ids:
                        for sub in sub_ids:
                            for brand in brand_ids:
                                triples.add((cat, sub, brand))

                    group_coverage[gid] = triples

                conflicts = []
                for i in range(len(group_ids)):
                    for j in range(i + 1, len(group_ids)):
                        gid_a = group_ids[i]
                        gid_b = group_ids[j]
                        overlap = group_coverage[gid_a] & group_coverage[gid_b]

                        if overlap:
                            name_a = DiscountGroup.objects.get(disc_id=gid_a).name
                            name_b = DiscountGroup.objects.get(disc_id=gid_b).name
                            conflicts.append(
                                f"'{name_a}' and '{name_b}' both cover the same category/subcategory/brand combination."
                            )

                if conflicts:
                    return Response({
                        'success':   False,
                        'error':     'Overlapping discount groups detected. Each product combination can only be covered by one discount group.',
                        'conflicts': conflicts
                    }, status=400)
            # ── END OVERLAP VALIDATION ────────────────────────────────────────────

            with transaction.atomic():
                CustomerDiscountGroup.objects.filter(customer=customer).delete()

                new_assignments = [
                    CustomerDiscountGroup(customer=customer, discount_group_id=dg_id)
                    for dg_id in group_ids
                ]
                CustomerDiscountGroup.objects.bulk_create(new_assignments)

            return Response({
                "success": True,
                "message": f"Successfully updated {len(group_ids)} assignments."
            }, status=status.HTTP_200_OK)

        except IntegrityError:
            return Response({
                "success": False,
                "error": "A conflict occurred: One of these groups is already assigned."
            }, status=400)
        except Customer.DoesNotExist:
            return Response({"success": False, "error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)    

class ProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        search       = request.data.get("search")
        category     = request.data.get("category")
        sub_category = request.data.get("sub_category")
        brand        = request.data.get("brand")
        page         = int(request.data.get("page", 1))

        products = Product.objects.select_related(
            'category', 'sub_category', 'brand', 'unit', 'material'
        ).all()

        if search:
            query = Q(product_name__icontains=search) | \
                    Q(product_description__icontains=search) | \
                    Q(size__icontains=search) | \
                    Q(capacity__icontains=search) | \
                    Q(warranty__icontains=search) | \
                    Q(category__category__icontains=search) | \
                    Q(sub_category__sub_category__icontains=search) | \
                    Q(brand__brand__icontains=search)

            if search.isdigit():
                num = int(search)
                query |= Q(id=num)
                query |= Q(max_head=num)
                query |= Q(price=float(num))

            products = products.filter(query).distinct()

        if category and category != "" and category != "All":
            if str(category).isdigit():
                products = products.filter(category_id=category)
            else:
                products = products.filter(category__category__iexact=category)

        if sub_category and sub_category != "" and sub_category != "All":
            if str(sub_category).isdigit():
                products = products.filter(sub_category_id=sub_category)
            else:
                products = products.filter(sub_category__sub_category__iexact=sub_category)

        if brand and brand != "" and brand != "All":
            if str(brand).isdigit():
                products = products.filter(brand_id=brand)
            else:
                products = products.filter(brand__brand__iexact=brand)

        # ── PAGINATION ────────────────────────────────────────────────────────────
        paginator = Paginator(products, 10)
        page_obj  = paginator.get_page(page)

        # ── SESSION: Get user role ────────────────────────────────────────────────
        user_role = request.session.get('user_role', '')

        if not user_role:
            return Response(
                {"success": False, "error": "Invalid session. Please login again."},
                status=status.HTTP_403_FORBIDDEN
            )
        is_owner  = user_role.lower() == 'owner'
        is_employee = user_role.lower() == 'employee'

        # ── DISCOUNT RESOLUTION ───────────────────────────────────────────────────
        # Owner sees no discounts — skip all discount logic entirely
        if is_owner:
            serializer    = ProductListSerializer(page_obj, many=True)
            serialized_data = list(serializer.data)
            for i in range(len(serialized_data)):
                serialized_data[i] = {**serialized_data[i], 'base_percent': 0.0, 'discount_id':  None,}

            return Response({
                "data":         serialized_data,
                "total_pages":  paginator.num_pages,
                "current_page": page_obj.number,
            })

        # ── Resolve which discount groups apply to this customer ──────────────────
        user_id  = request.session.get('user_id')
        disc_ids = set()
        type_ids = set()
        individual_ids = set()  # ✅ initialize here

        try:
            if not is_employee:
                customer = Customer.objects.get(user_id=user_id)

                individual_ids = set(
                    CustomerDiscountGroup.objects.filter(customer=customer)
                    .values_list('discount_group_id', flat=True)
                )

            if user_role and not is_owner:
                try:
                    customer_type = CustomerType.objects.get(type_name=user_role)
                    print(customer_type)
                    type_ids = set(
                        UserGroupDiscountProfile.objects.filter(customer_type=customer_type)
                        .values_list('discount_group_id', flat=True)
                    )
                except CustomerType.DoesNotExist:
                    pass

            disc_ids = individual_ids | type_ids

        except Customer.DoesNotExist:
            disc_ids = set()

        # ── Build lookup maps only for relevant discount groups ───────────────────
        cat_map = {}
        for row in DiscountGroupCategoryMap.objects.filter(group_id__in=disc_ids).values('group_id', 'category_id'):
            cat_map.setdefault(row['group_id'], set()).add(row['category_id'])

        sub_map = {}
        for row in DiscountGroupSubCategoryMap.objects.filter(group_id__in=disc_ids).values('group_id', 'sub_category_id'):
            sub_map.setdefault(row['group_id'], set()).add(row['sub_category_id'])

        brand_map = {}
        for row in DiscountGroupBrandMap.objects.filter(group_id__in=disc_ids).values('group_id', 'brand_id'):
            brand_map.setdefault(row['group_id'], set()).add(row['brand_id'])

        percent_map = {
            g.disc_id: g.base_percent
            for g in DiscountGroup.objects.filter(disc_id__in=disc_ids)
        }

        # ── Serialize and inject base_percent ────────────────────────────────────
        serializer      = ProductListSerializer(page_obj, many=True)
        serialized_data = list(serializer.data)

        for i, product in enumerate(page_obj):
            resolved = 0.0
            for disc_id, base_percent in percent_map.items():
                if (
                    product.category_id     in cat_map.get(disc_id, set()) and
                    product.sub_category_id in sub_map.get(disc_id, set()) and
                    product.brand_id        in brand_map.get(disc_id, set())
                ):
                    resolved = base_percent
                    resolved_disc_id = disc_id
                    break
            serialized_data[i] = {**serialized_data[i], 'base_percent': resolved, 'discount_id':  resolved_disc_id,}

        return Response({
            "data":         serialized_data,
            "total_pages":  paginator.num_pages,
            "current_page": page_obj.number,
        })

class DiscountGroupSettingsView(APIView):
    """
    GET    /api/discount-groups/        → list all groups
    POST   /api/discount-groups/        → create a new group
    PATCH  /api/discount-groups/<id>/   → rename / update base_percent
    DELETE /api/discount-groups/<id>/   → delete (cascades all mappings)
    """

    permission_classes = [IsAuthenticated]

    # ── List ──────────────────────────────────────────────────────────────────
    def get(self, request):
        groups = DiscountGroup.objects.all().order_by("name")
        data = [
            {"disc_id": g.disc_id, "name": g.name, "base_percent": g.base_percent}
            for g in groups
        ]
        return Response({"success": True, "data": data})

    # ── Create ────────────────────────────────────────────────────────────────
    def post(self, request):
        name         = request.data.get("name", "").strip()
        base_percent = request.data.get("base_percent", 0.0)

        if not name:
            return Response(
                {"success": False, "error": "name is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if DiscountGroup.objects.filter(name__iexact=name).exists():
            return Response(
                {"success": False, "error": f"A discount group named '{name}' already exists."},
                status=status.HTTP_409_CONFLICT
            )

        group = DiscountGroup.objects.create(name=name, base_percent=float(base_percent))
        return Response({
            "success": True,
            "data": {"disc_id": group.disc_id, "name": group.name, "base_percent": group.base_percent}
        }, status=status.HTTP_201_CREATED)

class DiscountGroupDetailView(APIView):
    """
    PATCH  /api/discount-groups/<disc_id>/
    DELETE /api/discount-groups/<disc_id>/
    """

    permission_classes = [IsAuthenticated]

    def _get_group(self, disc_id):
        try:
            return DiscountGroup.objects.get(disc_id=disc_id)
        except DiscountGroup.DoesNotExist:
            return None

    # ── Rename / update percent ───────────────────────────────────────────────
    def patch(self, request, disc_id):
        group = self._get_group(disc_id)
        if not group:
            return Response(
                {"success": False, "error": f"Discount group {disc_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        name         = request.data.get("name", "").strip()
        base_percent = request.data.get("base_percent", None)

        if not name:
            return Response(
                {"success": False, "error": "name is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Guard against duplicate name (excluding self)
        if DiscountGroup.objects.filter(name__iexact=name).exclude(disc_id=disc_id).exists():
            return Response(
                {"success": False, "error": f"A discount group named '{name}' already exists."},
                status=status.HTTP_409_CONFLICT
            )

        group.name = name
        if base_percent is not None:
            group.base_percent = float(base_percent)
        group.save()

        return Response({
            "success": True,
            "data": {"disc_id": group.disc_id, "name": group.name, "base_percent": group.base_percent}
        })

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete(self, request, disc_id):
        group = self._get_group(disc_id)
        if not group:
            return Response(
                {"success": False, "error": f"Discount group {disc_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        name = group.name
        group.delete()  # CASCADE handles all FK-linked rows automatically

        return Response({
            "success": True,
            "message": f"Discount group '{name}' and all its mappings have been deleted."
        })

class DiscountGroupAssociationsView(APIView):
    """
    GET  /api/discount-groups/<disc_id>/associations/
         Returns all current category, subcategory, and brand associations
         for a given discount group, plus all available options for each.

    POST /api/discount-groups/<disc_id>/associations/
         Add a new association.
         Body: { "type": "category"|"subcategory"|"brand", "target_id": <int> }

    DELETE /api/discount-groups/<disc_id>/associations/
         Remove an existing association.
         Body: { "type": "category"|"subcategory"|"brand", "target_id": <int> }
    """

    permission_classes = [IsAuthenticated]

    def _get_group(self, disc_id):
        try:
            return DiscountGroup.objects.get(disc_id=disc_id)
        except DiscountGroup.DoesNotExist:
            return None

    # ── GET: fetch all associations + available options ───────────────────────
    def get(self, request, disc_id):
        group = self._get_group(disc_id)
        if not group:
            return Response({"success": False, "error": "Discount group not found."}, status=404)

        # Current associations
        # ✅ After — use non-conflicting alias names
        linked_categories = list(
            DiscountGroupCategoryMap.objects.filter(group=group)
            .select_related("category")
            .values("id", linked_cat_id=F("category__id"), name=F("category__category"))
        )
        linked_subcategories = list(
            DiscountGroupSubCategoryMap.objects.filter(group=group)
            .select_related("sub_category")
            .values("id", linked_sub_id=F("sub_category__id"), name=F("sub_category__sub_category"))
        )
        linked_brands = list(
            DiscountGroupBrandMap.objects.filter(group=group)
            .select_related("brand")
            .values("id", linked_brand_id=F("brand__id"), name=F("brand__brand"))
        )

        linked_cat_ids   = [r["linked_cat_id"]   for r in linked_categories]
        linked_sub_ids   = [r["linked_sub_id"]   for r in linked_subcategories]
        linked_brand_ids = [r["linked_brand_id"] for r in linked_brands]

        available_categories = list(
            ProductCategory.objects.exclude(id__in=linked_cat_ids)
            .values("id", "category")
        )
        available_subcategories = list(
            ProductSubCategory.objects.exclude(id__in=linked_sub_ids)
            .values("id", "sub_category")
        )
        available_brands = list(
            ProductBrand.objects.exclude(id__in=linked_brand_ids)
            .values("id", "brand")
        )

        return Response({
            "success": True,
            "group": {
                "disc_id":      group.disc_id,
                "name":         group.name,
                "base_percent": group.base_percent,
            },
            "associations": {
                "categories":    linked_categories,
                "subcategories": linked_subcategories,
                "brands":        linked_brands,
            },
            "available": {
                "categories":    available_categories,
                "subcategories": available_subcategories,
                "brands":        available_brands,
            },
        })

    # ── POST: add a new association ───────────────────────────────────────────
    def post(self, request, disc_id):
        group = self._get_group(disc_id)
        if not group:
            return Response({"success": False, "error": "Discount group not found."}, status=404)

        assoc_type = request.data.get("type")
        target_id  = request.data.get("target_id")

        if not assoc_type or not target_id:
            return Response({"success": False, "error": "type and target_id are required."}, status=400)

        try:
            if assoc_type == "category":
                cat = ProductCategory.objects.get(id=target_id)
                obj, created = DiscountGroupCategoryMap.objects.get_or_create(group=group, category=cat)
                if not created:
                    return Response({"success": False, "error": "This category is already linked."}, status=409)
                return Response({"success": True, "message": f"Category '{cat.category}' linked."})

            elif assoc_type == "subcategory":
                sub = ProductSubCategory.objects.get(id=target_id)
                obj, created = DiscountGroupSubCategoryMap.objects.get_or_create(group=group, sub_category=sub)
                if not created:
                    return Response({"success": False, "error": "This subcategory is already linked."}, status=409)
                return Response({"success": True, "message": f"Subcategory '{sub.sub_category}' linked."})

            elif assoc_type == "brand":
                brand = ProductBrand.objects.get(id=target_id)
                obj, created = DiscountGroupBrandMap.objects.get_or_create(group=group, brand=brand)
                if not created:
                    return Response({"success": False, "error": "This brand is already linked."}, status=409)
                return Response({"success": True, "message": f"Brand '{brand.brand}' linked."})

            else:
                return Response({"success": False, "error": "type must be category, subcategory, or brand."}, status=400)

        except (ProductCategory.DoesNotExist, ProductSubCategory.DoesNotExist, ProductBrand.DoesNotExist):
            return Response({"success": False, "error": f"{assoc_type.capitalize()} with id={target_id} not found."}, status=404)

    # ── DELETE: remove an association ─────────────────────────────────────────
    def delete(self, request, disc_id):
        group = self._get_group(disc_id)
        if not group:
            return Response({"success": False, "error": "Discount group not found."}, status=404)

        assoc_type = request.data.get("type")
        target_id  = request.data.get("target_id")

        if not assoc_type or not target_id:
            return Response({"success": False, "error": "type and target_id are required."}, status=400)

        if assoc_type == "category":
            deleted, _ = DiscountGroupCategoryMap.objects.filter(group=group, category_id=target_id).delete()
        elif assoc_type == "subcategory":
            deleted, _ = DiscountGroupSubCategoryMap.objects.filter(group=group, sub_category_id=target_id).delete()
        elif assoc_type == "brand":
            deleted, _ = DiscountGroupBrandMap.objects.filter(group=group, brand_id=target_id).delete()
        else:
            return Response({"success": False, "error": "type must be category, subcategory, or brand."}, status=400)

        if not deleted:
            return Response({"success": False, "error": "Association not found."}, status=404)

        return Response({"success": True, "message": "Association removed."})

class CreateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            data = request.data

            user = request.user
            user_role = request.session.get('user_role')

            items = data.get("items", [])
            customer_id = data.get("customer_id")

            if not items:
                return Response({"error": "No items provided"}, status=400)

            if user_role == "Employee":
                if not customer_id:
                    return Response({"error": "Customer required"}, status=400)
                customer = Customer.objects.get(id=customer_id)
                employee_id = user.id

                # ✅ Max 3 pending Employee-placed orders at a time
                pending_employee_orders = Orders.objects.filter(
                    Customer=customer,
                    Employee_id=employee_id,
                    Status="pending"
                ).count()

                if pending_employee_orders >= 3:
                    return Response({
                        "error": "Maximum 3 pending orders allowed per customer. Please wait for existing orders to be processed."
                    }, status=400)

            # 🔹 If Retailer / Builder / Plumber / Dealer placing order
            else:
                customer = Customer.objects.get(user=user)
                employee_id = None

                # ✅ Block if any pending order exists for this customer
                has_pending = Orders.objects.filter(
                    Customer=customer,
                    Status="pending"
                ).exists()

                if has_pending:
                    return Response({
                        "error": "You already have a pending order. Please wait for it to be processed before placing a new one."
                    }, status=400)

            with transaction.atomic():

                # ✅ Step 1: Pre-calculate total and collect item data
                total_amount = 0
                order_items_data = []

                for item in items:
                    product = Product.objects.get(id=item["product_id"])
                    qty = item["quantity"]
                    selling_price = item["selling_price"]
                    line_total = qty * selling_price
                    total_amount += line_total

                    print("The discount is: ", item.get("discount_id"))

                    order_items_data.append({
                        "product": product,
                        "qty": qty,
                        "mrp": product.price,
                        "selling_price": selling_price,
                        "discount_id": item.get("discount_id"),
                        "line_total": line_total,
                    })

                # ✅ Step 2: Create order
                order = Orders.objects.create(
                    Customer=customer,
                    Employee_id=employee_id,
                    Status="pending",
                    Total_Amount=total_amount
                )

                # ✅ Step 3: Create order items
                for item_data in order_items_data:
                    OrderItems.objects.create(
                        Order=order,
                        Product=item_data["product"],
                        Qty=item_data["qty"],
                        MRP=item_data["mrp"],
                        Selling_Price=item_data["selling_price"],
                        Discount_id=item_data["discount_id"],
                        Line_Total=item_data["line_total"],
                    )

                # ✅ Step 4: Get or create Conversation
                if user_role == "Employee":
                    title = "System"
                    conversation = Conversation.objects.create(
                            status="open",
                            Order=order,
                            user=user,
                            title=title,
                        )
                    ConversationParticipant.objects.create(
                            conversation=conversation,
                            user=user,
                            user_type="Employee",
                            role="Handler"
                        )
                else:
                    title = "Support"

                    # ✅ Close last completed-but-still-open conversation before creating new one
                    last_completed_conv = Conversation.objects.filter(
                        user=user,
                        status="open",
                        Order__Customer=customer,
                        Order__Status="completed",
                        Order__Employee__isnull=True,
                    ).order_by('-created_at').first()

                    if last_completed_conv:
                        Message.objects.create(
                            Conversation=last_completed_conv,
                            Sender=None,
                            sender_type="system",
                            message_type="order_request",
                            message_text=(
                                f"Order #{last_completed_conv.Order.Order_Id} has been received. "
                                f"Conversation closed as new order has been placed."
                            ),
                            is_read=False,
                        )
                        last_completed_conv.status = "closed"
                        last_completed_conv.last_message_at = timezone.now()
                        last_completed_conv.save()

                    conversation = Conversation.objects.create(
                        status="open",
                        Order=order,
                        user=user,
                        title=title,
                    )

                    ConversationParticipant.objects.create(
                        conversation=conversation,
                        user=user,
                        user_type=customer.customer_type.type_name,
                        role="Primary"
                    )

                    employee = User.objects.filter(is_staff=True).first()
                    if employee:
                        ConversationParticipant.objects.create(
                            conversation=conversation,
                            user=employee,
                            user_type="Employee",
                            role="Handler"
                        )
                # ✅ Step 6: Build system message text
                product_names = ", ".join([d["product"].product_name for d in order_items_data])

                if user_role == "Employee":
                    system_text = (
                        f"Order #{order.Order_Id} has been created for "
                        f"{customer.customer_name} by "
                        f"{user.get_full_name() or user.username} (Employee). "
                        f"Items: {product_names}. "
                        f"Total: Rs.{total_amount:,.2f}."
                    )

                    Message.objects.create(
                        Conversation=conversation,
                        Sender=None,
                        sender_type="system",
                        message_type="order_request",
                        message_text=system_text,
                        is_read=False
                    )

                    conversation.last_message_at = timezone.now()
                    conversation.save()

                    return Response({
                        "message": "Order created successfully",
                        "order_id": order.Order_Id,
                        "conversation_id": conversation.Conversation_Id
                    })

                else:
                    system_text = (
                        f"Order #{order.Order_Id} has been placed successfully by "
                        f"{customer.customer_name}. "
                        f"Items: {product_names}. "
                        f"Total: Rs.{total_amount:,.2f}."
                    )

                    return Response({
                        "message": "Order created successfully",
                        "order_id": order.Order_Id,
                        "system_text": system_text,
                        "conversation_id": conversation.Conversation_Id
                    })

        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)

        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            user      = request.user
            user_role = request.session.get('user_role')
            now       = timezone.now()

            def time_ago(dt):
                if not dt:
                    return ""
                total_seconds = int((now - dt).total_seconds())
                if total_seconds < 60:
                    return "Just now"
                elif total_seconds < 3600:
                    return f"{total_seconds // 60}m ago"
                elif total_seconds < 86400:
                    return f"{total_seconds // 3600}h ago"
                else:
                    return f"{(now - dt).days}d ago"

            # ── 1. Employee ───────────────────────────────────────────────────────
            if user_role == "Employee":

                owner_user = User.objects.filter(is_superuser=True).first()

                owner_direct_conv = Conversation.objects.filter(
                    Order__isnull=True,
                    title="owner_direct",
                    participants__user=user,
                ).first()

                if not owner_direct_conv and owner_user:
                    owner_direct_conv = Conversation.objects.create(
                        title="owner_direct",
                        status="open",
                        user=user,
                    )
                    ConversationParticipant.objects.create(
                        conversation=owner_direct_conv,
                        user=user,
                        user_type="Employee",
                    )
                    ConversationParticipant.objects.create(
                        conversation=owner_direct_conv,
                        user=owner_user,
                        user_type="Owner",
                    )

                participant_conv_ids = ConversationParticipant.objects.filter(
                    user=user
                ).values_list('conversation_id', flat=True)

                all_convs = Conversation.objects.filter(
                    Conversation_Id__in=participant_conv_ids
                ).select_related(
                    'Order', 'Order__Customer', 'Order__Customer__customer_type',
                    'Order__Customer__reward', 'Order__Employee',
                ).prefetch_related(
                    'messages',
                    'Order__actions'
                # ✅ FIX 1: order by created_at descending so the newest conv
                # per customer is always encountered first in the loop below.
                # last_message_at is NULL for brand-new convs with no messages,
                # which caused older convs to sort ahead of newer ones.
                ).order_by('-created_at')

                result         = []
                system_orders  = []
                system_unread  = 0
                system_last_dt = None

                # ✅ FIX 2: track seen customer_ids in a set instead of scanning
                # result list with next(). The previous O(n²) scan also had a
                # subtle bug: it compared against result entries that were added
                # AFTER the current iteration started, so the "first match" was
                # not guaranteed to be the most-recently-created conversation.
                seen_customer_ids = set()

                for conv in all_convs:
                    order    = conv.Order
                    customer = order.Customer if order else None

                    if not order:
                        continue

                    last_msg     = conv.messages.order_by('-created_at').first()
                    unread_count = conv.messages.filter(
                        is_read=False
                    ).exclude(sender_type="Employee").count()

                    # ── Employee-placed order → System row ───────────────────────
                    if order.Employee_id and order.Employee.is_staff:
                        system_unread += unread_count
                        if conv.last_message_at:
                            if not system_last_dt or conv.last_message_at > system_last_dt:
                                system_last_dt = conv.last_message_at

                        system_orders.append({
                            "conv_id":        conv.Conversation_Id,
                            "order_id":       order.Order_Id,
                            "customer":       customer.customer_name if customer else "",
                            "order_status":   order.Status,
                            "conv_status":    conv.status,
                            "payment_status": order.payment_status,
                            "time":           time_ago(conv.last_message_at),
                        })
                        continue

                    # ── Customer-placed order → one row per customer ──────────────
                    customer_id = order.Customer.id if order.Customer else None

                    # ✅ FIX 2 (continued): because we sorted by -created_at,
                    # the first time we see a customer_id is always their newest
                    # conversation. Skip all subsequent (older) convs for them.
                    if customer_id in seen_customer_ids:
                        continue
                    seen_customer_ids.add(customer_id)

                    customer_type_name = (
                        customer.customer_type.type_name
                        if customer and customer.customer_type else ""
                    )
                    latest_action = order.actions.order_by('-created_at').first()

                    result.append({
                        "id":          conv.Conversation_Id,
                        "name":        customer.customer_name if customer else "",
                        "type":        customer_type_name,
                        "lastMessage": last_msg.message_text if last_msg else "",
                        "time":        time_ago(conv.last_message_at),
                        "unread":      unread_count,
                        "rewards":     customer.reward.reward_points if customer and customer.reward else 0,
                        "order": {
                            "order_id":       order.Order_Id,
                            "order_status":   order.Status,
                            "conv_status":    conv.status,
                            "customer_id":    customer_id,
                            "payment_status": order.payment_status,
                            "latest_action":  latest_action.action_type if latest_action else None,
                        },
                    })

                if owner_direct_conv:
                    last_msg     = owner_direct_conv.messages.order_by('-created_at').first()
                    unread_count = owner_direct_conv.messages.filter(
                        is_read=False
                    ).exclude(sender_type="Employee").count()

                    result.insert(0, {
                        "id":          owner_direct_conv.Conversation_Id,
                        "name":        "Owner",
                        "type":        "direct",
                        "lastMessage": last_msg.message_text if last_msg else "Say hello to the Owner!",
                        "time":        time_ago(owner_direct_conv.last_message_at),
                        "unread":      unread_count,
                        "rewards":     0,
                        "order":       None,
                        "isDirect":    True,
                    })

                if system_orders:
                    result.append({
                        "id":      "system",
                        "name":    "System",
                        "type":    "Employee",
                        "time":    time_ago(system_last_dt),
                        "unread":  system_unread,
                        "orders":  system_orders,
                        "order":   None,
                    })

                return Response({"conversations": result}, status=200)

            # ── 2. Owner ──────────────────────────────────────────────────────────
            elif user_role == "Owner":
                result         = []
                system_orders  = []
                system_unread  = 0
                system_last_dt = None

                try:
                    direct_convs = Conversation.objects.filter(
                        Order__isnull=True,
                        title="owner_direct",
                        participants__user=user,
                        participants__user_type="Owner",
                    ).prefetch_related('messages', 'participants').order_by('-last_message_at')

                    for dconv in direct_convs:
                        last_msg     = dconv.messages.order_by('-created_at').first()
                        unread_count = dconv.messages.filter(
                            is_read=False
                        ).exclude(sender_type="Owner").count()

                        emp_participant = dconv.participants.filter(user_type="Employee").first()
                        emp_name = (
                            emp_participant.user.get_full_name() or emp_participant.user.username
                            if emp_participant else "Employee"
                        )
                        result.append({
                            "id":          dconv.Conversation_Id,
                            "name":        emp_name,
                            "type":        "direct",
                            "lastMessage": last_msg.message_text if last_msg else "",
                            "time":        time_ago(dconv.last_message_at),
                            "unread":      unread_count,
                            "rewards":     0,
                            "order":       None,
                            "isDirect":    True,
                        })

                except Exception as e:
                    print("OWNER DIRECT CONV ERROR:", e)
                    raise

                owner_conv_ids = ConversationParticipant.objects.filter(
                    user=user,
                    user_type="Owner"
                ).values_list('conversation_id', flat=True)

                forwarded_convs = Conversation.objects.filter(
                    Conversation_Id__in=owner_conv_ids,
                    status="order forwarded",
                ).select_related(
                    'Order', 'Order__Customer', 'Order__Customer__customer_type',
                    'Order__Customer__reward', 'Order__Employee',
                ).prefetch_related(
                    'messages',
                    'Order__actions'
                # ✅ same fix: order by -created_at for consistency
                ).order_by('-created_at')

                for conv in forwarded_convs:
                    order    = conv.Order
                    customer = order.Customer if order else None

                    last_msg     = conv.messages.order_by('-created_at').first()
                    unread_count = conv.messages.filter(
                        is_read=False
                    ).exclude(sender_type="Owner").count()

                    customer_type_name = (
                        customer.customer_type.type_name
                        if customer and customer.customer_type else ""
                    )

                    if order and order.Employee_id and order.Employee.is_staff:
                        system_unread += unread_count
                        if conv.last_message_at:
                            if not system_last_dt or conv.last_message_at > system_last_dt:
                                system_last_dt = conv.last_message_at

                        system_orders.append({
                            "conv_id":        conv.Conversation_Id,
                            "order_id":       order.Order_Id,
                            "customer":       customer.customer_name if customer else "",
                            "order_status":   order.Status,
                            "conv_status":    conv.status,
                            "payment_status": order.payment_status,
                            "time":           time_ago(conv.last_message_at),
                        })
                        continue

                    latest_action = order.actions.order_by('-created_at').first()

                    result.append({
                        "id":          conv.Conversation_Id,
                        "name":        f"{customer.customer_name} — Order #{order.Order_Id}" if customer and order else conv.title,
                        "type":        customer_type_name,
                        "lastMessage": last_msg.message_text if last_msg else "",
                        "time":        time_ago(conv.last_message_at),
                        "unread":      unread_count,
                        "rewards":     customer.reward.reward_points if customer and customer.reward else 0,
                        "order": {
                            "order_id":       order.Order_Id,
                            "order_status":   order.Status,
                            "conv_status":    conv.status,
                            "payment_status": order.payment_status,
                            "latest_action":  latest_action.action_type if latest_action else None,
                        },
                    })

                if system_orders:
                    result.append({
                        "id":     "system",
                        "name":   "System",
                        "type":   "Employee",
                        "time":   time_ago(system_last_dt),
                        "unread": system_unread,
                        "orders": system_orders,
                        "order":  None,
                    })

                return Response({"conversations": result}, status=200)

            # ── 3. Retailer / Builder / Dealer / Plumber ──────────────────────────
            else:
                customer_conv_ids = ConversationParticipant.objects.filter(
                    user=user,
                    user_type__in=["Retailer", "Builder", "Dealer", "Plumber"]
                ).values_list('conversation_id', flat=True)

                # ✅ same fix: order by -created_at so .first() gives the newest
                conv = Conversation.objects.filter(
                    Conversation_Id__in=customer_conv_ids
                ).select_related(
                    'Order', 'Order__Customer',
                    'Order__Customer__customer_type',
                    'Order__Customer__reward',
                ).prefetch_related(
                    'messages',
                    'Order__actions'
                ).order_by('-created_at').first()

                if not conv:
                    return Response({"conversations": []}, status=200)

                order    = conv.Order
                customer = order.Customer if order else None

                last_msg     = conv.messages.order_by('-created_at').first()
                unread_count = conv.messages.filter(
                    is_read=False
                ).exclude(sender_type=user_role).count()

                latest_action = order.actions.order_by('-created_at').first()

                result = [{
                    "id":          conv.Conversation_Id,
                    "name":        conv.title,
                    "type":        user_role,
                    "lastMessage": last_msg.message_text if last_msg else "",
                    "time":        time_ago(conv.last_message_at),
                    "unread":      unread_count,
                    "rewards":     customer.reward.reward_points if customer and customer.reward else 0,
                    "order": {
                        "order_id":       order.Order_Id if order else None,
                        "order_status":   order.Status   if order else None,
                        "conv_status":    conv.status,
                        "payment_status": order.payment_status,
                        "latest_action":  latest_action.action_type if latest_action else None,
                    },
                }]

                return Response({"conversations": result}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id, *args, **kwargs):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            # ── Helper to serialize a message ────────────────────────────────────
            def serialize_msg(msg, conv):
                # ✅ Check if this order_request message has already been accepted/rejected
                is_actionable = False
                if msg.message_type == "order_request" and conv.Order:
                    is_actionable = not conv.Order.actions.filter(
                        action_type__in=["accepted", "rejected"]
                    ).exists()

                return {
                    "id":           msg.Message_id,
                    "from":         msg.sender_type.lower(),
                    "sender_label": msg.sender_type.capitalize(),
                    "text":         msg.message_text,
                    "time":         msg.created_at.strftime("%I:%M %p"),
                    "messageType":  msg.message_type,
                    "is_read":      msg.is_read,
                    "order_id":     conv.Order.Order_Id if conv.Order else None,
                    "order_status": conv.Order.Status   if conv.Order else None,
                    "conv_status":  conv.status,
                    "customer_name": conv.Order.Customer.customer_name if conv.Order and conv.Order.Customer else None,
                    "is_actionable": is_actionable,  # ✅ new field
                }

            # ── 1. System row — Employee viewing their own placed orders ─────────
            if conversation_id == "system":

                if user_role == "Employee":
                    # ✅ Employee sees their own placed orders
                    conv_ids = ConversationParticipant.objects.filter(
                        user=user,
                        user_type="Employee"
                    ).values_list('conversation_id', flat=True)

                    system_convs = Conversation.objects.filter(
                        Conversation_Id__in=conv_ids,
                        Order__Employee__isnull=False,
                        Order__Employee__is_staff=True,
                    ).select_related('Order', 'Order__Customer').prefetch_related('Order__actions' ).order_by('created_at')

                    # Mark as read
                    for conv in system_convs:
                        conv.messages.exclude(sender_type="Employee").update(is_read=True)

                    all_messages = []
                    for conv in system_convs:
                        forward_msg = conv.messages.filter(message_type="forwarded").first()
                        msgs = conv.messages.select_related('Sender').order_by('created_at')

                        if forward_msg and conv.status == "closed":
                            # ✅ Show before forward + final accepted/rejected message
                            before_forward = msgs.filter(created_at__lte=forward_msg.created_at)
                            final_msg = conv.messages.filter(
                                message_type__in=["order_accepted", "rejected"]
                            ).order_by('-created_at').first()

                            for msg in before_forward:
                                all_messages.append(serialize_msg(msg, conv))
                            if final_msg:
                                all_messages.append(serialize_msg(final_msg, conv))

                        elif forward_msg and conv.status != "closed":
                            # ✅ Still with Owner, show only up to forward
                            for msg in msgs.filter(created_at__lte=forward_msg.created_at):
                                all_messages.append(serialize_msg(msg, conv))

                        else:
                            # ✅ Not forwarded — show all (includes completed orders)
                            for msg in msgs:
                                all_messages.append(serialize_msg(msg, conv))

                elif user_role == "Owner":
                    # ✅ Owner sees only forwarded Employee-placed orders
                    conv_ids = ConversationParticipant.objects.filter(
                        user=user,
                        user_type="Owner"
                    ).values_list('conversation_id', flat=True)

                    system_convs = Conversation.objects.filter(
                        Conversation_Id__in=conv_ids,
                        Order__Employee__isnull=False,
                        Order__Employee__is_staff=True,
                        status="order forwarded",   # ✅ only forwarded ones
                    ).select_related('Order', 'Order__Customer').prefetch_related('Order__actions').order_by('created_at')

                    # Mark as read
                    for conv in system_convs:
                        conv.messages.exclude(sender_type="Owner").update(is_read=True)

                    all_messages = []
                    for conv in system_convs:
                        # ✅ Owner sees ALL messages including after forwarding
                        msgs = conv.messages.select_related('Sender').order_by('created_at')
                        for msg in msgs:
                            all_messages.append(serialize_msg(msg, conv))

                else:
                    return Response({"error": "Access denied"}, status=403)

                all_messages.sort(key=lambda m: m["id"])

                return Response({
                    "messages":     all_messages,
                    "orderRequest": None,
                }, status=200)
            
            # ── 2. Direct Owner↔Employee chat (Order=NULL) ───────────────────────────
            conv_check = Conversation.objects.filter(
                Conversation_Id=conversation_id,
                Order__isnull=True,
                title="owner_direct",
            ).first()

            if conv_check:
                # Verify user is a participant
                is_participant = ConversationParticipant.objects.filter(
                    conversation_id=conversation_id,
                    user=user,
                ).exists()

                if not is_participant:
                    return Response({"error": "Access denied"}, status=403)

                # Mark as read
                conv_check.messages.exclude(sender_type=user_role).update(is_read=True)

                msgs = conv_check.messages.select_related('Sender').order_by('created_at')
                all_messages = []
                for msg in msgs:
                    all_messages.append({
                        "id":           msg.Message_id,
                        "from":         msg.sender_type.lower(),
                        "sender_label": msg.sender_type.capitalize(),
                        "text":         msg.message_text,
                        "time":         msg.created_at.strftime("%I:%M %p"),
                        "messageType":  msg.message_type,
                        "is_read":      msg.is_read,
                        "order_id":     None,
                        "order_status": None,
                        "conv_status":  conv_check.status,
                        "customer_name": None,
                    })

                return Response({
                    "messages":     all_messages,
                    "orderRequest": None,
                }, status=200)
            
            
            # ── 2. Employee — viewing a Retailer's conversation ──────────────────
            if user_role == "Employee":

                # Verify Employee is a participant
                is_participant = ConversationParticipant.objects.filter(
                    conversation_id=conversation_id,
                    user=user
                ).exists()

                if not is_participant:
                    return Response({"error": "Access denied"}, status=403)

                conv = Conversation.objects.select_related(
                    'Order',
                    'Order__Customer',
                    'Order__Employee',
                ).get(Conversation_Id=conversation_id)

                # Fetch all conversations for this customer (user_id)
                # but only Retailer-placed ones (no Employee field)
                all_conv_ids = Conversation.objects.filter(
                    user_id=conv.user_id,
                    Order__Employee__isnull=True,  # ✅ only customer-placed convs
                ).values_list('Conversation_Id', flat=True)

                # Mark all as read
                for cid in all_conv_ids:
                    Message.objects.filter(
                        Conversation_id=cid
                    ).exclude(sender_type=user_role).update(is_read=True)

                all_messages = []
                all_convs = Conversation.objects.filter(
                    Conversation_Id__in=all_conv_ids
                ).select_related(
                    'Order',
                    'Order__Customer',
                ).prefetch_related('Order__actions'  ).order_by('created_at')

                for c in all_convs:
                    # ✅ Find the forwarded system message timestamp
                    forward_msg = c.messages.filter(message_type="forwarded").first()
                    msgs = c.messages.select_related('Sender').order_by('created_at')
                    
                    # ✅ If forwarded, only show messages up to and including the forward message
                    if forward_msg and c.status == "closed":
                        # ✅ Show messages up to forward + only the final accepted/rejected message
                        before_forward = msgs.filter(created_at__lte=forward_msg.created_at)
                        final_msg = c.messages.filter(
                            message_type__in=["order_accepted", "rejected"]
                        ).order_by('-created_at').first()

                        for msg in before_forward:
                            all_messages.append(serialize_msg(msg, c))
                        if final_msg:
                            all_messages.append(serialize_msg(final_msg, c))

                    elif forward_msg and c.status != "closed":
                        # ✅ Still forwarded, show only up to forward message
                        for msg in msgs.filter(created_at__lte=forward_msg.created_at):
                            all_messages.append(serialize_msg(msg, c))

                    else:
                        # ✅ Not forwarded, show all
                        for msg in msgs:
                            all_messages.append(serialize_msg(msg, c))

                all_messages.sort(key=lambda m: m["id"])

                # Order request from the clicked conversation                # Order request from the clicked conversation
                order_request = None
                if conv.Order:
                    order        = conv.Order
                    first_item   = order.items.select_related('Product').first()
                    latest_action = order.actions.order_by('-created_at').first()  # ✅ add this
                    order_request = {
                        "order_id":         order.Order_Id,
                        "product":          first_item.Product.product_name if first_item else "",
                        "qty":              first_item.Qty if first_item else 0,
                        "priceFromBackend": first_item.Selling_Price if first_item else 0,
                        "requestedAt":      order.Order_date.strftime("%d %b %Y, %I:%M %p"),
                        "status":           order.Status,
                        "latest_action":    latest_action.action_type if latest_action else None,  # ✅ add this
                    }

                return Response({
                    "messages":     all_messages,
                    "orderRequest": order_request,
                }, status=200)
            
            # ── 3. Owner — viewing a forwarded conversation ──────────────────────
            elif user_role == "Owner":

                # Verify Owner is a participant
                is_participant = ConversationParticipant.objects.filter(
                    conversation_id=conversation_id,
                    user=user
                ).exists()

                if not is_participant:
                    return Response({"error": "Access denied"}, status=403)

                conv = Conversation.objects.select_related(
                    'Order',
                    'Order__Customer',
                ).prefetch_related('Order__actions' ).get(Conversation_Id=conversation_id)

                # Mark all as read
                conv.messages.exclude(sender_type=user_role).update(is_read=True)

                all_messages = []
                msgs = conv.messages.select_related('Sender').order_by('created_at')
                for msg in msgs:
                    all_messages.append(serialize_msg(msg, conv))

                # Order request
                order_request = None
                if conv.Order:
                    order        = conv.Order
                    first_item   = order.items.select_related('Product').first()
                    latest_action = order.actions.order_by('-created_at').first()  # ✅
                    order_request = {
                        "order_id":         order.Order_Id,
                        "product":          first_item.Product.product_name if first_item else "",
                        "qty":              first_item.Qty if first_item else 0,
                        "priceFromBackend": first_item.Selling_Price if first_item else 0,
                        "requestedAt":      order.Order_date.strftime("%d %b %Y, %I:%M %p"),
                        "status":           order.Status,
                        "latest_action":    latest_action.action_type if latest_action else None,  # ✅
                    }
                return Response({
                    "messages":     all_messages,
                    "orderRequest": order_request,
                }, status=200)

            # ── 4. Retailer / Builder / Dealer / Plumber ─────────────────────────
            else:

                all_conv_ids = ConversationParticipant.objects.filter(
                    user=user,
                    user_type__in=["Retailer", "Builder", "Dealer", "Plumber"]
                ).values_list('conversation_id', flat=True)

                # Mark all as read
                for cid in all_conv_ids:
                    Message.objects.filter(
                        Conversation_id=cid
                    ).exclude(sender_type=user_role).update(is_read=True)

                all_messages = []
                all_convs = Conversation.objects.filter(
                    Conversation_Id__in=all_conv_ids
                ).select_related(
                    'Order',
                    'Order__Customer',
                ).prefetch_related('Order__actions').order_by('created_at')

                for conv in all_convs:
                    msgs = conv.messages.select_related('Sender').order_by('created_at')
                    for msg in msgs:
                        all_messages.append(serialize_msg(msg, conv))

                all_messages.sort(key=lambda m: m["id"])

                # Order request from most recent conversation
                latest_conv = all_convs.order_by('-created_at').first()
                order_request = None
                if latest_conv and latest_conv.Order:
                    order        = latest_conv.Order
                    first_item   = order.items.select_related('Product').first()
                    latest_action = order.actions.order_by('-created_at').first()  # ✅
                    order_request = {
                        "order_id":         order.Order_Id,
                        "product":          first_item.Product.product_name if first_item else "",
                        "qty":              first_item.Qty if first_item else 0,
                        "priceFromBackend": first_item.Selling_Price if first_item else 0,
                        "requestedAt":      order.Order_date.strftime("%d %b %Y, %I:%M %p"),
                        "status":           order.Status,
                        "latest_action":    latest_action.action_type if latest_action else None,  # ✅
                    }

                return Response({
                    "messages":     all_messages,
                    "orderRequest": order_request,
                }, status=200)

        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            conversation_id = request.data.get("conversation_id")
            message_text    = request.data.get("message_text", "").strip()

            if not message_text:
                return Response({"error": "Message cannot be empty"}, status=400)

            # ✅ Verify user is a participant
            is_participant = ConversationParticipant.objects.filter(
                conversation_id=conversation_id,
                user=user
            ).exists()

            if not is_participant:
                return Response({"error": "Access denied"}, status=403)

            conv = Conversation.objects.get(Conversation_Id=conversation_id)

            # ✅ Block Employee from sending if conversation is forwarded
            if conv.status == "order forwarded" and user_role == "Employee":
                return Response(
                    {"error": "This conversation has been forwarded to the Owner. You cannot send messages."},
                    status=403
                )

            msg = Message.objects.create(
                Conversation=conv,
                Sender=user,
                sender_type=user_role,
                message_type="order_request" if message_text.startswith("Order #") else "text",
                message_text=message_text,
                is_read=False
            )
            msg_type = msg.message_type  # ✅ uses what was actually saved

            push_message_to_ws(conv.Conversation_Id, {
                "type":       "new_message",
                "id":         msg.Message_id,
                "from":       msg.sender_type.lower(),
                "text":       msg.message_text,
                "time":       msg.created_at.strftime("%I:%M %p"),
                "messageType": msg_type,
                "order_id":   None,
                "order_status": None,
                "conv_status":   conv.status,  # ✅ add this
            })

            conv.last_message_at = timezone.now()
            conv.save()

            return Response({
                "message": {
                    "id":          msg.Message_id,
                    "from":        msg.sender_type.lower(),
                    "text":        msg.message_text,
                    "time":        msg.created_at.strftime("%I:%M %p"),
                    "messageType": msg_type,    # ✅
                    "is_read":     msg.is_read,
                    "order_id":    conv.Order.Order_Id if conv.Order else None,
                    "order_status": conv.Order.Status if conv.Order else None,
                }
            }, status=201)

        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            conv_ids = ConversationParticipant.objects.filter(
                user=user
            ).values_list('conversation_id', flat=True)

            unread_count = Message.objects.filter(
                Conversation_id__in=conv_ids,
                is_read=False
            ).exclude(
                sender_type=user_role
            ).count()

            return Response({"unread_count": unread_count}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class AcceptOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        """Fetch order items for the Accept modal"""
        try:
            order = Orders.objects.prefetch_related('items__Product').get(Order_Id=order_id)
            items = [
                {
                    "product_name": item.Product.product_name,
                    "qty":          item.Qty,
                    "mrp":          item.MRP,
                    "selling_price": item.Selling_Price,
                    "line_total":   item.Line_Total,
                }
                for item in order.items.all()
            ]
            return Response({
                "order_id":     order.Order_Id,
                "total_amount": order.Total_Amount,
                "customer":     order.Customer.customer_name,
                "status":       order.Status,
                "items":        items,
            })
        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def post(self, request, order_id):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            delivery_date = request.data.get("delivery_date")
            note          = request.data.get("note", "")

            if not delivery_date:
                return Response({"error": "Delivery date is required"}, status=400)

            order = Orders.objects.get(Order_Id=order_id)

            if order.Status != "pending":
                return Response({"error": "Order is no longer pending"}, status=400)

            order.Status = "pending"
            order.save()

            conversation = Conversation.objects.get(Order=order)

            # ✅ Parse delivery_date string into datetime
            # Try with seconds first, fall back to without seconds
            try:
                delivery_datetime = datetime.strptime(delivery_date, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                delivery_datetime = datetime.strptime(delivery_date, "%Y-%m-%d %H:%M")

            OrderAction.objects.create(
                Conversation=conversation,
                Order=order,
                action_type="accepted",
                notes=note,
                performed_by_type=user_role,
                performed_by=user,
                expected_delivery=delivery_datetime,  # ✅ save here
            )

            system_text = (
                f"Order #{order.Order_Id} has been accepted. "
                f"Expected delivery: {delivery_date}."
                + (f" Note: {note}" if note else "")
            )
            msg = Message.objects.create(
                Conversation=conversation,
                Sender=None,
                sender_type="system",
                message_type="order_accepted",
                message_text=system_text,
                is_read=False
            )

            push_message_to_ws(conversation.Conversation_Id, {
                "type":         "new_message",
                "id":           msg.Message_id,
                "from":         "system",
                "text":         msg.message_text,
                "time":         msg.created_at.strftime("%I:%M %p"),
                "order_id":     order.Order_Id,
                "order_status": order.Status,
                "conv_status":   conversation.status,  # ✅ add this

            })

            # ✅ Remove Owner participant only when Owner accepts
            if user_role == "Owner":
                ConversationParticipant.objects.filter(
                    Conversation=conversation,
                    user_type="Owner"
                ).delete()

            conversation.last_message_at = timezone.now()
            conversation.status = "open"  # ✅ close the conversation on accept
            conversation.save()

            return Response({"message": "Order accepted successfully"}, status=200)

        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
class RejectOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            reason = request.data.get("reason", "")
            note   = request.data.get("note", "")

            if not reason:
                return Response({"error": "Rejection reason is required"}, status=400)

            order = Orders.objects.get(Order_Id=order_id)

            if order.Status != "pending":
                return Response({"error": "Order is no longer pending"}, status=400)

            # ✅ Update order status
            order.Status = "cancelled"
            order.save()

            conversation = Conversation.objects.get(Order=order)

            # ✅ Create OrderAction
            OrderAction.objects.create(
                Conversation=conversation,
                Order=order,
                action_type="rejected",
                reason=reason,
                notes=note,
                performed_by_type=user_role,
                performed_by=user,
            )

            # ✅ Create system message
            system_text = (
                f"Order #{order.Order_Id} has been rejected. "
                f"Reason: {reason}."
                + (f" Note: {note}" if note else "")
            )
            msg = Message.objects.create(
                Conversation=conversation,
                Sender=None,
                sender_type="system",
                message_type="rejected",
                message_text=system_text,
                is_read=False
            )

            push_message_to_ws(conversation.Conversation_Id, {
                "type":         "new_message",
                "id":           msg.Message_id,
                "from":         "system",
                "text":         msg.message_text,
                "time":         msg.created_at.strftime("%I:%M %p"),
                "order_id":     order.Order_Id,
                "order_status": order.Status,
                "conv_status":   conversation.status,  # ✅ add this

            })

            # ✅ Remove Owner participant only when Owner accepts
            if user_role == "Owner":
                ConversationParticipant.objects.filter(
                    Conversation=conversation,
                    user_type="Owner"
                ).delete()

            conversation.last_message_at = timezone.now()
            conversation.status = "open"
            conversation.save()

            return Response({"message": "Order rejected successfully"}, status=200)

        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ForwardToOwnerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            note = request.data.get("note", "")

            # ✅ Only Employee can forward
            if user_role != "Employee":
                return Response({"error": "Only Employee can forward orders"}, status=403)

            order        = Orders.objects.get(Order_Id=order_id)
            conversation = Conversation.objects.get(Order=order)

            # ✅ Check if Owner is already a participant
            owner_user = User.objects.filter(
                conversation_participations__conversation=conversation,
                conversation_participations__user_type="Owner"
            ).first()

            if owner_user:
                return Response({"error": "Order already forwarded to Owner"}, status=400)

            owner = User.objects.filter(is_superuser=True).first()

            if not owner:
                return Response({"error": "No Owner found in the system"}, status=404)

            # ✅ Add Owner as conversation participant
            ConversationParticipant.objects.create(
                conversation=conversation,
                user=owner,
                user_type="Owner",
                role="Supervisor",
            )

            # ✅ Update conversation status
            conversation.status = "order forwarded"
            conversation.last_message_at = timezone.now()
            conversation.save()

            # ✅ Create OrderAction
            OrderAction.objects.create(
                Conversation=conversation,
                Order=order,
                action_type="forwarded",
                notes=note,
                performed_by_type=user_role,
                performed_by=user,
            )

            # ✅ Create system message
            system_text = (
                f"Order #{order.Order_Id} has been forwarded to the Owner for review."
                + (f" Note: {note}" if note else "")
            )
            msg = Message.objects.create(
                Conversation=conversation,
                Sender=None,
                sender_type="system",
                message_type="forwarded",
                message_text=system_text,
                is_read=False
            )

            # ✅ Push to WebSocket
            push_message_to_ws(conversation.Conversation_Id, {
                "type":         "new_message",
                "id":           msg.Message_id,
                "from":         "system",
                "messageType": msg.message_type,
                "text":         msg.message_text,
                "time":         msg.created_at.strftime("%I:%M %p"),
                "order_id":     order.Order_Id,
                "order_status": order.Status,
                "conv_status":   conversation.status,  # ✅ add this

            })

            return Response({"message": "Order forwarded to Owner successfully"}, status=200)

        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class CustomerAcceptedOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id=None):  # ✅ customer_id is now optional
        try:
            user_role = request.session.get('user_role')

            if customer_id:
                # ✅ Employee/Owner fetching a specific customer's orders
                customer = Customer.objects.get(id=customer_id)
            else:
                # ✅ Customer fetching their own orders
                customer = Customer.objects.get(user=request.user)

            orders = Orders.objects.filter(
                Customer=customer,
                Status="completed",
            ).order_by('-Order_date')

            orders_data = []
            for order in orders:
                orders_data.append({
                    "order_id":     order.Order_Id,
                    "date":         order.Order_date.strftime("%d %b %Y"),
                    "total_amount": float(order.Total_Amount),
                    "item_count":   order.items.count(),
                })

            return Response({"orders": orders_data}, status=200)

        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
class ReturnOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            conversation_id = request.data.get('conversation_id')
            items_data      = request.data.get('items', [])

            if not items_data:
                return Response({"error": "No items provided for return"}, status=400)

            # ✅ Get the order
            order = Orders.objects.get(Order_Id=order_id)

            # ✅ Get the conversation
            conversation = Conversation.objects.get(
                Conversation_Id=conversation_id
            )

            # ✅ Verify user is a participant
            is_participant = ConversationParticipant.objects.filter(
                conversation=conversation,
                user=user
            ).exists()

            if not is_participant:
                return Response({"error": "Access denied"}, status=403)

            # ✅ Get the customer
            if user_role in ["Employee", "Owner"]:
                customer = order.Customer
            else:
                customer = Customer.objects.get(user=user)

            return_records = []
            stock_updates  = []
            system_lines   = []

            with transaction.atomic():
                for item_data in items_data:
                    item_id = item_data.get('item_id')
                    qty     = int(item_data.get('qty', 1))
                    reason  = item_data.get('reason', '')

                    # ✅ Get the OrderItem
                    order_item = OrderItems.objects.get(
                        Item_Id=item_id,
                        Order=order
                    )

                    # ✅ Validate return qty doesn't exceed ordered qty
                    already_returned = Return.objects.filter(
                        Order_Item=order_item
                    ).aggregate(
                        total=Sum('Return_Qty')
                    )['total'] or 0

                    remaining_returnable = order_item.Qty - already_returned
                    if qty > remaining_returnable:
                        return Response({
                            "error": f"Cannot return {qty} of '{order_item.Product.product_name}'. Only {remaining_returnable} returnable."
                        }, status=400)

                    # ✅ Create Return record
                    return_record = Return.objects.create(
                        Order=order,
                        Order_Item=order_item,
                        Conversation=conversation,
                        Return_Qty=qty,
                        Return_reason=reason,
                        status='approved',        # ✅ auto-approve for now
                        Requested_By=customer,
                        Processed_By=user,
                    )
                    return_records.append(return_record)

                    # ✅ Restock only if reason is NOT damage-related
                    DAMAGE_REASONS = ["Damaged Product", "Quality Issue"]
                    if reason not in DAMAGE_REASONS:
                        product = order_item.Product
                        product.current_stock += qty          # ✅ updates live stock on Product
                        product.save(update_fields=['current_stock'])
                        Stock.objects.create(
                            product=product,
                            qty_updated=qty,                  # ✅ positive = restock, new log row
                            user=user,
                            return_entry=return_record,
                        )
                        stock_updates.append(product.product_name)

                    system_lines.append(
                        f"{order_item.Product.product_name} ×{qty} — {reason}"
                    )

                # ✅ Create system message in conversation
                restock_note = (
                    f" Restocked: {', '.join(stock_updates)}."
                    if stock_updates else
                    " No restock (damaged items)."
                )

                system_text = (
                    f"Return request for Order #{order.Order_Id}:\n"
                    + "\n".join(f"• {line}" for line in system_lines)
                    + restock_note
                )

                msg = Message.objects.create(
                    Conversation=conversation,
                    Sender=None,
                    sender_type="system",
                    message_type="return_request",
                    message_text=system_text,
                    is_read=False,
                )

                conversation.last_message_at = timezone.now()
                conversation.save()

                # ✅ Push to WebSocket
                try:
                    push_message_to_ws(conversation.Conversation_Id, {
                        "type":        "new_message",
                        "id":          msg.Message_id,
                        "from":        "system",
                        "text":        msg.message_text,
                        "time":        msg.created_at.strftime("%I:%M %p"),
                        "messageType": msg.message_type,
                        "order_id":    order.Order_Id,
                        "order_status": order.Status,
                        "conv_status": conversation.status,
                    })
                except Exception as ws_err:
                    print(f"WS push failed: {ws_err}")

            return Response({
                "message": "Return request submitted successfully",
                "returns_created": len(return_records),
                "restocked": stock_updates,
            }, status=201)

        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except OrderItems.DoesNotExist:
            return Response({"error": "Order item not found"}, status=404)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=404)
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 1. All orders for a specific customer (for Retailer/Builder/etc panel)
class CustomerOrderHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        try:
            user_role = request.session.get('user_role')
            if user_role not in ["Employee", "Owner"]:
                return Response({"error": "Access denied"}, status=403)

            customer = Customer.objects.select_related(
                'customer_type', 'reward'
            ).get(id=customer_id)

            orders = Orders.objects.filter(
                Customer=customer
            ).prefetch_related('items__Product').order_by('-Order_date')
            
            total_spent = orders.aggregate(
                total=Sum('Total_Amount')
            )['total'] or 0

            orders_data = []
            for order in orders:
                items = [
                    f"{item.Product.product_name} x{item.Qty}"
                    for item in order.items.all()
                ]
                total    = float(order.Total_Amount)
                # For now payment type is always "full" unless you have a Payment model
                # Adjust this once you have payment data
                orders_data.append({
                    "id":          f"ORD-{order.Order_Id}",
                    "date":        order.Order_date.strftime("%Y-%m-%d"),
                    "status":      order.Status.capitalize(),
                    "paymentType": order.payment_status,
                    "paidPercent": order.percentage_paid,
                    "amountPaid":  round(total * (order.percentage_paid / 100), 2),  # ✅ calculate from percentage
                    "totalAmount": total,
                    "items":       items,
                })

            return Response({
                "customer": {
                    "name":        customer.customer_name,
                    "type":        customer.customer_type.type_name if customer.customer_type else "",
                    "totalOrders": orders.count(),
                    "totalSpent": f"₹{float(total_spent):,.0f}",
                    "rewards":     customer.reward.reward_points if customer.reward else 0,
                },
                "orders": orders_data,
            }, status=200)

        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 2. All final consumers with at least one order (for System chat panel)
class ConsumerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_role = request.session.get('user_role')
            if user_role not in ["Employee", "Owner"]:
                return Response({"error": "Access denied"}, status=403)

            # Customers who have at least one order
            # ✅ Fixed — only customers whose orders were placed by an Employee
            customers = Customer.objects.filter(
                orders__Employee__isnull=False,       # ✅ order must have an Employee
                orders__Employee__is_staff=True,      # ✅ that Employee must be staff
            ).select_related(
                'customer_type', 'reward'
            ).distinct()

            result = []
            for customer in customers:
                # ✅ Only get Employee-placed orders for last order info
                last_order = Orders.objects.filter(
                    Customer=customer,
                    Employee__isnull=False,       # ✅ only Employee-placed
                    Employee__is_staff=True,
                ).order_by('-Order_date').first()

                if not last_order:
                    continue

                result.append({
                    "customer_id":   customer.id,
                    "name":          customer.customer_name,
                    "type":          customer.customer_type.type_name if customer.customer_type else "",
                    "totalOrders": Orders.objects.filter(
                        Customer=customer,
                        Employee__isnull=False,
                        Employee__is_staff=True,
                    ).count(),
                    "rewards":       customer.reward.reward_points if customer.reward else 0,
                    "lastOrderId":   f"ORD-{last_order.Order_Id}",
                    "lastOrderDate": last_order.Order_date.strftime("%Y-%m-%d"),
                    "lastOrderStatus": last_order.Status.capitalize(),
                })

            return Response({"consumers": result}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)


class RecordPaymentView(View):
    """
    POST /api/orders/<order_id>/payment/

    Body:
        {
            "amount":           1500.0,
            "mode":             "cash",   // cash | cheque | neft | upi | other
            "note":             "Received at counter",   // optional
            "conversation_id":  42        // the conv to post the system message in
        }

    What it does:
        1. Validates the amount (must be > 0, must not overpay).
        2. Creates a Payment record.
        3. Adds amount to Orders.amount_paid and calls .save() — your existing
           save() method auto-recalculates payment_status and percentage_paid.
        4. Posts a system Message in the conversation so the Owner is notified.
        5. Returns updated order payment info.
    """

    def post(self, request, order_id):
        try:
            data            = json.loads(request.body)
            amount          = float(data.get("amount", 0))
            mode            = data.get("mode", "").strip()
            note            = data.get("note", "").strip()
            conversation_id = data.get("conversation_id")
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid request body."}, status=400)

        # ── Validate ──────────────────────────────────────────────────────────
        if amount <= 0:
            return JsonResponse({"error": "Amount must be greater than zero."}, status=400)

        VALID_MODES = {"cash", "cheque", "neft", "upi", "other"}
        if mode not in VALID_MODES:
            return JsonResponse({"error": f"Invalid payment mode. Choose from: {', '.join(VALID_MODES)}."}, status=400)

        try:
            order = Orders.objects.select_for_update().get(Order_Id=order_id)
        except Orders.DoesNotExist:
            return JsonResponse({"error": "Order not found."}, status=404)

        # Prevent overpayment
        remaining = order.Total_Amount - order.amount_paid
        if amount > remaining + 0.01:   # small float tolerance
            return JsonResponse({
                "error": f"Payment of ₹{amount} exceeds remaining balance of ₹{round(remaining, 2)}."
            }, status=400)

        # ── Atomic write ──────────────────────────────────────────────────────
        with transaction.atomic():

            # 1. Create Payment record
            payment = Payment.objects.create(
                order       = order,
                amount      = amount,
                mode        = mode,
                note        = note or None,
                recorded_by = request.user,
            )

            # 2. Update Orders — your save() handles the rest
            order.amount_paid = round(order.amount_paid + amount, 2)
            order.save()

            # 3. Post system message in conversation (if provided)
            if conversation_id:
                try:
                    conversation = Conversation.objects.get(
                        Conversation_Id=conversation_id
                    )
                    recorder_name = (
                        request.user.get_full_name()
                        or request.user.username
                    )
                    mode_display = dict(Payment.PAYMENT_MODE_CHOICES).get(mode, mode)
                    msg_text = (
                        f"Payment of ₹{int(amount):,} received for "
                        f"Order #{order.Order_Id} via {mode_display}"
                        f" by {recorder_name}."
                    )
                    Message.objects.create(
                        Conversation  = conversation,
                        Sender        = request.user,
                        message_text  = msg_text,
                        message_type  = "payment_recorded",   # ← add this to MESSAGE_TYPE_CHOICES
                        sender_type   = "system",
                        is_read       = False,
                    )
                    # Update conversation last_message_at
                    conversation.last_message_at = timezone.now()
                    conversation.save(update_fields=["last_message_at"])
                except Conversation.DoesNotExist:
                    pass  # Don't fail the payment if conv lookup fails

        # ── Response ──────────────────────────────────────────────────────────
        return JsonResponse({
            "success":        True,
            "payment_id":     payment.payment_id,
            "amount_paid":    order.amount_paid,
            "total_amount":   order.Total_Amount,
            "remaining":      round(order.Total_Amount - order.amount_paid, 2),
            "payment_status": order.payment_status,
            "percentage_paid": order.percentage_paid,
        })


class PaymentHistoryView(View):
    """
    GET /api/orders/<order_id>/payments/

    Returns all Payment records for an order, plus current order payment summary.
    Used by the Owner dashboard to drill into a specific order's payment history.
    """

    def get(self, request, order_id):
        try:
            order = Orders.objects.get(Order_Id=order_id)
        except Orders.DoesNotExist:
            return JsonResponse({"error": "Order not found."}, status=404)

        payments = Payment.objects.filter(order=order).order_by("-recorded_at")

        return JsonResponse({
            "order_id":       order.Order_Id,
            "total_amount":   order.Total_Amount,
            "amount_paid":    order.amount_paid,
            "remaining":      round(order.Total_Amount - order.amount_paid, 2),
            "payment_status": order.payment_status,
            "percentage_paid": order.percentage_paid,
            "payments": [
                {
                    "payment_id":  p.payment_id,
                    "amount":      p.amount,
                    "mode":        p.mode,
                    "note":        p.note,
                    "recorded_by": p.recorded_by.get_full_name() or p.recorded_by.username,
                    "recorded_at": p.recorded_at.strftime("%d %b %Y, %I:%M %p"),
                }
                for p in payments
            ],
        })

class CustomerDueOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user      = request.user
            user_role = request.session.get('user_role')

            # ✅ For Retailer/Builder/Dealer/Plumber — their own due orders
            customer = Customer.objects.get(user=user)

            orders = Orders.objects.filter(
                Customer=customer,
                Status__in=["pending", "completed"],  # ✅ include completed but unpaid
            ).exclude(
                payment_status="full"
            ).select_related('Customer').order_by('-Order_date')

            orders_data = []
            for order in orders:
                conv = Conversation.objects.filter(
                    Order=order
                ).values_list('Conversation_Id', flat=True).first()

                orders_data.append({
                    "order_id":      order.Order_Id,
                    "customer_name": order.Customer.customer_name,
                    "total_amount":  float(order.Total_Amount),
                    "amount_paid":   float(order.amount_paid),
                    "remaining":     round(float(order.Total_Amount) - float(order.amount_paid), 2),
                    "payment_status": order.payment_status,
                    "conv_id":       conv,
                    "order_date":    order.Order_date.strftime("%d %b %Y"),
                })

            return Response({"orders": orders_data}, status=200)

        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class DailyPaymentSummaryView(View):
    """
    GET /api/payments/today/

    Returns all payments recorded today — for the Owner dashboard card.
    """

    def get(self, request):
        from django.db.models import Sum

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        payments = (
            Payment.objects
            .filter(recorded_at__gte=today_start)
            .select_related("order", "order__Customer", "recorded_by")
            .order_by("-recorded_at")
        )

        total_today = payments.aggregate(total=Sum("amount"))["total"] or 0

        return JsonResponse({
            "total_today": round(total_today, 2),
            "count":       payments.count(),
            "payments": [
                {
                    "payment_id":     p.payment_id,
                    "order_id":       p.order.Order_Id,
                    "customer_name":  p.order.Customer.customer_name,
                    "amount":         p.amount,
                    "mode":           p.mode,
                    "recorded_by":    p.recorded_by.get_full_name() or p.recorded_by.username,
                    "recorded_at":    p.recorded_at.strftime("%I:%M %p"),
                    "payment_status": p.order.payment_status,
                }
                for p in payments
            ],
        })

class ConsumerDueOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user

            # ✅ All Employee-placed orders that are accepted but not fully paid
            orders = Orders.objects.filter(
                Employee=user,
                Status="pending",
            ).exclude(
                payment_status="full"
            ).select_related(
                'Customer'
            ).prefetch_related('items__Product').order_by('-Order_date')

            orders_data = []
            for order in orders:
                orders_data.append({
                    "order_id":      order.Order_Id,
                    "customer_name": order.Customer.customer_name,
                    "total_amount":  float(order.Total_Amount),
                    "amount_paid":   float(order.amount_paid),
                    "remaining":     round(float(order.Total_Amount) - float(order.amount_paid), 2),
                    "payment_status": order.payment_status,
                    "conv_id":       Conversation.objects.filter(Order=order).values_list('Conversation_Id', flat=True).first(),
                })

            return Response({"orders": orders_data}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

VALID_FORWARD_ACTIONS = ["order_packed", "order_loaded", "order_on_the_way"]

PREREQUISITE_MAP = {
    "order_packed":    "accepted",
    "order_loaded":    "order_packed",
    "order_on_the_way": "order_loaded",
}

DELAYABLE_FROM = {"order_packed", "order_loaded", "order_on_the_way"}

ACTION_LABELS = {
    "order_packed":     "Order packed and ready for dispatch",
    "order_loaded":     "Order loaded onto vehicle",
    "order_on_the_way": "Order is on the way",
    "delayed":          "Order delivery has been delayed",
    "resume":           "Order delivery has resumed",
    "order_received":   "Order received by customer",
}

MSG_TYPE_MAP = {
    "order_packed":     "order_packed",
    "order_loaded":     "order_loaded",
    "order_on_the_way": "order_on_the_way",
    "delayed":          "order_delayed",
    "resume":           "order_resumed",
    "order_received":   "order_received",
}

def get_latest_action(order):
    return (
        OrderAction.objects
        .filter(Order=order)
        .order_by('-created_at')
        .first()
    )

class OrderStatusUpdateView(APIView):
    """
    POST /api/orders/<order_id>/status/
 
    Body:
        {
            "action_type": "order_packed" | "order_loaded" | "order_on_the_way"
                           | "delayed" | "resume",
            "note": "..."   (required for delayed, optional for others)
        }
 
    Rules:
    - Only Employee or Owner can call this.
    - Forward actions (packed/loaded/on_the_way) must follow sequence.
    - "delayed" can be applied at packed / loaded / on_the_way.
      → Sets conv_status = "delayed". Blocks any further forward action.
    - "resume" reverses "delayed".
      → Restores conv_status to what it was before delayed.
      → Requires a note explaining the resumption.
    - Cannot mark the same forward action twice.
    - Order must be in pending status (not completed / cancelled).
    """
 
    permission_classes = [IsAuthenticated]
 
    def post(self, request, order_id):
        try:
            user        = request.user
            user_role   = request.session.get('user_role')
            action_type = request.data.get("action_type", "").strip()
            note        = request.data.get("note", "").strip()
 
            # ── Auth ─────────────────────────────────────────────────────────
            if user_role not in ("Employee", "Owner"):
                return Response(
                    {"error": "Only Employee or Owner can update order status"},
                    status=403
                )
 
            # ── Validate action_type ──────────────────────────────────────────
            all_valid = VALID_FORWARD_ACTIONS + ["delayed", "resume"]
            if action_type not in all_valid:
                return Response(
                    {"error": f"Invalid action. Choose from: {all_valid}"},
                    status=400
                )
 
            # ── Delayed requires a note ───────────────────────────────────────
            if action_type == "delayed" and not note:
                return Response(
                    {"error": "A note is required when marking an order as delayed."},
                    status=400
                )
 
            order = Orders.objects.select_related(
                'Customer__customer_type', 'Employee'
            ).get(Order_Id=order_id)
 
            if order.Status == "cancelled":
                return Response({"error": "Order has been cancelled"}, status=400)
            if order.Status == "completed":
                return Response({"error": "Order is already completed"}, status=400)
 
            conversation = Conversation.objects.get(Order=order)

            # ✅ Add here
            latest_action = get_latest_action(order)
            latest_type = latest_action.action_type if latest_action else None

            # ── Block forward actions when delayed ────────────────────────────
            if action_type in VALID_FORWARD_ACTIONS:
                if latest_type == "delayed":

                    return Response(
                        {"error": "Order is delayed. Resume it before progressing."},
                        status=400
                    )
 
            # ── Resume: only valid if currently delayed ───────────────────────
            if action_type == "resume":
                if latest_type != "delayed":
                    return Response(
                        {"error": f"Cannot resume because current state is '{latest_type}'."},
                        status=400
                    )

 
            # ── Delayed: only valid from a delayable status ───────────────────
            if action_type == "delayed":
                if latest_type not in DELAYABLE_FROM:
                    return Response(
                        {"error": f"Cannot delay from '{latest_type}'. Order must be packed, loaded, or on the way."},
                        status=400
                    )
 
            # ── Forward action: validate sequence ────────────────────────────
            if action_type in VALID_FORWARD_ACTIONS:
                prerequisite = PREREQUISITE_MAP[action_type]
 
                prereq_exists = OrderAction.objects.filter(
                    Order=order, action_type=prerequisite
                ).exists()
                if not prereq_exists:
                    return Response(
                        {"error": f"Cannot mark '{action_type}' before "
                                  f"'{prerequisite}' is recorded."},
                        status=400
                    )
 
                already_done = OrderAction.objects.filter(
                    Order=order, action_type=action_type
                ).exists()
                if already_done:
                    return Response(
                        {"error": f"'{action_type}' already recorded for this order."},
                        status=400
                    )
 
            with transaction.atomic():
 
                # ── Record OrderAction ────────────────────────────────────────
                OrderAction.objects.create(
                    Conversation=conversation,
                    Order=order,
                    action_type=action_type,
                    notes=note or None,
                    performed_by_type=user_role,
                    performed_by=user,
                )

                if action_type == "order_loaded":
                    for item in order.items.select_related('Product').all():
                        product = item.Product

                        # Update live stock on Product
                        # Using max(0, ...) ensures stock doesn't go negative if there's a logic error
                        product.current_stock = max(0, product.current_stock - item.Qty)
                        product.save(update_fields=['current_stock'])

                        # Log the change in Stock audit table
                        Stock.objects.create(
                            product=product,
                            qty_updated=-item.Qty,  # Negative value represents deduction
                            user=user,
                            order=order,
                        )
 
                # ── System message ────────────────────────────────────────────
                label       = ACTION_LABELS.get(action_type, action_type)
                system_text = (
                    f"{label} for Order #{order.Order_Id}."
                    + (f" Note: {note}" if note else "")
                )
                msg_type = MSG_TYPE_MAP.get(action_type, "system")
 
                msg = Message.objects.create(
                    Conversation=conversation,
                    Sender=None,
                    sender_type="system",
                    message_type=msg_type,
                    message_text=system_text,
                    is_read=False,
                )
 
                try:
                    push_message_to_ws(conversation.Conversation_Id, {
                        "type":         "new_message",
                        "id":           msg.Message_id,
                        "from":         "system",
                        "text":         msg.message_text,
                        "time":         msg.created_at.strftime("%I:%M %p"),
                        "messageType":  msg.message_type,
                        "order_id":     order.Order_Id,
                        "order_status": order.Status,
                        "conv_status":  conversation.status,
                    })
                except Exception as ws_err:
                    print(f"WS push failed: {ws_err}")
 
            return Response({
                "message":      f"Order status updated to '{action_type}'",
                "conv_status":  conversation.status,
                "order_status": order.Status,
            }, status=200)
 
        except Orders.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ActiveOrdersView(APIView):
    """
    GET /api/orders/active/
 
    Returns all accepted-but-not-yet-completed orders for the dashboard.
    Used by Employee and Owner to see what needs to be progressed.
 
    Response shape per order:
    {
        order_id, customer_name, customer_type,
        total_amount, order_date,
        latest_action,        ← e.g. "order_packed"
        conv_status,          ← mirrors latest_action, or "delayed"
        is_delayed,           ← bool
        is_employee_order,    ← bool (consumer order vs retailer etc)
        next_valid_actions,   ← list of what can be done next
        expected_delivery,    ← from the "accepted" action
        items: [{product_name, qty}]
    }
    """
 
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        try:
            user_role = request.session.get('user_role')
 
            if user_role not in ("Employee", "Owner"):
                return Response({"error": "Access denied"}, status=403)
 
            # All pending orders that have been accepted
            accepted_order_ids = OrderAction.objects.filter(
                action_type="accepted"
            ).values_list('Order_id', flat=True)
 
            orders = Orders.objects.filter(
                Order_Id__in=accepted_order_ids,
                Status="pending",       # still in progress
            ).select_related(
                'Customer__customer_type',
                'Employee',
            ).prefetch_related(
                'items__Product',
                'actions',
            ).order_by('Order_date')
 
            result = []
 
            for order in orders:
                conv = Conversation.objects.filter(Order=order).first()
                if not conv:
                    continue
 
                # Latest action (excluding forwarded/rejected/accepted for display)
                # Get all actions sorted
                all_actions = list(order.actions.all().order_by('-created_at'))

                # 1. Get accepted action separately (ALWAYS needed)
                accepted_action = next(
                    (a for a in all_actions if a.action_type == "accepted"),
                    None
                )

                # 2. Get latest meaningful action (exclude noise)
                latest_action_obj = next(
                    (a for a in all_actions if a.action_type not in ["forwarded", "rejected"]),
                    None
                )

                # 3. Fallback logic (VERY IMPORTANT)
                if latest_action_obj:
                    latest_action = latest_action_obj.action_type
                else:
                    latest_action = "accepted" if accepted_action else None

                is_delayed = latest_action == "delayed"
                is_employee_order = order.Employee_id is not None
 
                # Determine next valid actions
                next_valid_actions = []

                if latest_action == "delayed":
                    next_valid_actions = ["resume"]

                else:
                    # Forward flow
                    for action in VALID_FORWARD_ACTIONS:
                        if latest_action == PREREQUISITE_MAP[action]:
                            next_valid_actions.append(action)
                            break

                    # Delay allowed
                    if latest_action in DELAYABLE_FROM:
                        next_valid_actions.append("delayed")

                    # Mark received
                    if latest_action == "order_on_the_way":
                        next_valid_actions.append("order_received")

                # Expected delivery from accepted action
                accepted_action = next(
                    (a for a in order.actions.all() if a.action_type == "accepted"),
                    None
                )

                expected_delivery = (
                    accepted_action.expected_delivery.strftime("%d %b %Y, %I:%M %p")
                    if accepted_action and accepted_action.expected_delivery else None
                )
 
                customer_type = (
                    order.Customer.customer_type.type_name
                    if order.Customer and order.Customer.customer_type else ""
                )
 
                result.append({
                    "order_id":          order.Order_Id,
                    "customer_name":     order.Customer.customer_name if order.Customer else "",
                    "customer_type":     customer_type,
                    "total_amount":      order.Total_Amount,
                    "payment_status":    order.payment_status,
                    "order_date":        order.Order_date.strftime("%d %b %Y"),
                    "latest_action":     latest_action,
                    "conv_status": "delayed" if latest_action == "delayed" else latest_action,

                    "is_delayed":        is_delayed,
                    "is_employee_order": is_employee_order,
                    "next_valid_actions": next_valid_actions,
                    "expected_delivery": expected_delivery,
                    "conversation_id":   conv.Conversation_Id,
                    "items": [
                        {
                            "product_name": item.Product.product_name,
                            "qty":          item.Qty,
                        }
                        for item in order.items.select_related('Product').all()
                    ],
                })
 
            return Response({"orders": result, "count": len(result)}, status=200)
 
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class OrderReceivedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            user = request.user
            note = request.data.get("note", "")

            # ── 1. Get Order ─────────────────────────────────────────
            try:
                order = Orders.objects.get(Order_Id=order_id)
            except Orders.DoesNotExist:
                return Response({"error": "Order not found"}, status=404)

            # ── 2. Get Conversation ─────────────────────────────────
            conv = Conversation.objects.filter(Order=order).first()
            if not conv:
                return Response({"error": "Conversation not found"}, status=404)

            # ── 3. Get latest valid action ──────────────────────────
            actions = order.actions.all().order_by('-created_at')

            latest_action_obj = next(
                (a for a in actions if a.action_type not in ["forwarded", "rejected"]),
                None
            )

            latest_action = latest_action_obj.action_type if latest_action_obj else "accepted"

            # ── 4. Validation ───────────────────────────────────────
            if latest_action != "order_on_the_way":
                return Response({
                    "error": f"Order cannot be marked as received from '{latest_action}' state"
                }, status=400)

            if order.Status == "completed":
                return Response({
                    "error": "Order already completed"
                }, status=400)

            # ── 5. Create Order Action ──────────────────────────────
            OrderAction.objects.create(
                Order=order,
                Conversation=conv,
                action_type="order_received",
                notes=note,
                performed_by=user,
                performed_by_type=request.session.get("user_role", "Unknown"),
            )

            # ── 6. Update Order Status ──────────────────────────────
            order.Status = "completed"
            order.save()

            # ── 7. Update Conversation ─────────────────────────────
            conv.status = "closed"
            conv.last_message_at = timezone.now()
            conv.save()

            # ── 8. Create System Message ───────────────────────────
            Message.objects.create(
                Conversation=conv,
                message_text=note if note else "Order marked as received.",
                message_type="order_received",
                sender_type="system",
                Sender=user
            )

            return Response({
                "message": "Order marked as received successfully"
            }, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

# ── Add to base/views.py ─────────────────────────────────────────────────────

SETTINGS_FIELDS = [
    "email_notifications", "order_alerts", "marketing_emails",
    "customer_messages", "system_notifications", "low_stock_alerts",
    "alert_sound", "vibration", "priority",
    "two_factor", "session_timeout",
    "dark_mode", "compact_view",
    "language", "number_format",
]

def serialize_settings(s):
    return {field: getattr(s, field) for field in SETTINGS_FIELDS}

DEFAULT_SETTINGS = {
    "email_notifications":  True,
    "order_alerts":         True,
    "marketing_emails":     False,
    "customer_messages":    True,
    "system_notifications": True,
    "low_stock_alerts":     True,
    "alert_sound":          True,
    "vibration":            False,
    "priority":             "high",
    "two_factor":           False,
    "session_timeout":      True,
    "dark_mode":            False,
    "compact_view":         False,
    "language":             "en",
    "number_format":        "en-IN",
}


class UserSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/employee/settings/"""
        try:
            s, _ = UserSettings.objects.get_or_create(user=request.user)
            return Response(serialize_settings(s), status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def patch(self, request):
        """PATCH /api/employee/settings/update/ — partial update"""
        try:
            s, _ = UserSettings.objects.get_or_create(user=request.user)

            # ✅ Reset to defaults if requested
            if request.data.get("reset"):
                for field, value in DEFAULT_SETTINGS.items():
                    setattr(s, field, value)
                s.save()
                return Response(serialize_settings(s), status=200)

            # ✅ Partial update — only update fields present in request
            for field in SETTINGS_FIELDS:
                if field in request.data:
                    value = request.data[field]
                    # ✅ Validate priority
                    if field == "priority" and value not in ["high", "medium", "low"]:
                        return Response(
                            {"error": "Invalid priority. Choose: high, medium, low."},
                            status=400
                        )
                    setattr(s, field, value)

            s.save()
            return Response(serialize_settings(s), status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def put(self, request):
        """PUT /api/employee/settings/update/ — reset to defaults"""
        try:
            s, _ = UserSettings.objects.get_or_create(user=request.user)
            for field, value in DEFAULT_SETTINGS.items():
                setattr(s, field, value)
            s.save()
            return Response(serialize_settings(s), status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """POST /api/employee/change-password/"""
        try:
            old_password = request.data.get("old_password", "")
            new_password = request.data.get("new_password", "")

            if not old_password or not new_password:
                return Response(
                    {"error": "Both old and new passwords are required."},
                    status=400
                )

            # ✅ Verify old password
            if not request.user.check_password(old_password):
                return Response(
                    {"error": "Old password is incorrect."},
                    status=400
                )

            # ✅ Validate new password strength
            if len(new_password) < 8:
                return Response(
                    {"error": "New password must be at least 8 characters."},
                    status=400
                )

            # ✅ Prevent reuse of same password
            if request.user.check_password(new_password):
                return Response(
                    {"error": "New password must be different from your current password."},
                    status=400
                )

            # ✅ Set new password
            request.user.set_password(new_password)
            request.user.save()

            # ✅ Update session so user isn't logged out
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, request.user)

            return Response({"message": "Password changed successfully."}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class OverduePaymentsView(View):
    """
    GET /api/payments/overdue/
    Used by the dashboard to show the owner the list of overdue orders.
    """
    def get(self, request):
        cutoff = timezone.now() - relativedelta(months=2)

        overdue_orders = (
            Orders.objects
            .filter(payment_status__in=["due", "partial"])
            .annotate(last_payment_at=Max("payments__recorded_at"))
            .filter(
                Q(last_payment_at__lte=cutoff) |
                Q(last_payment_at__isnull=True, Order_date__lte=cutoff)
            )
            .select_related("Customer")
            .order_by("last_payment_at", "Order_date")
        )

        results = []
        for o in overdue_orders:
            reference_date = o.last_payment_at or o.Order_date
            now = timezone.now()
            months_overdue = (now.year - reference_date.year) * 12 + (now.month - reference_date.month)

            results.append({
                "order_id": o.Order_Id,
                "customer_name": o.Customer.customer_name,
                "customer_phone": o.Customer.phone_number,
                "due_amount": round(o.Total_Amount - o.amount_paid, 2),
                "months_overdue": max(0, months_overdue),
                "order_date": o.Order_date.strftime("%d %b %Y"),
            })

        return JsonResponse({"count": len(results), "orders": results})

class OverdueNotifyView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            order_id = data.get("order_id")

            order = Orders.objects.select_related("Customer").get(
                Order_Id=order_id,
                payment_status__in=["due", "partial"]
            )

            due_amount = order.Total_Amount - order.amount_paid
            
            # 1. Calculate months manually or via your model property
            # Use the logic you already had in the GET view
            reference_date = order.Order_date # Or last payment if you prefer
            now = timezone.now()
            months = (now.year - reference_date.year) * 12 + (now.month - reference_date.month)

            # 2. Trigger the Twilio SMS service
            sid = send_overdue_sms(
                phone_number=order.Customer.phone_number,
                customer_name=order.Customer.customer_name,
                order_id=order.Order_Id,
                due_amount=due_amount,
                months=max(0, months)
            )

            return JsonResponse({"success": True, "sms_sid": sid})

        except Orders.DoesNotExist:
            return JsonResponse({"error": "Order not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# base/views.py
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from .models import DailyReport

def view_report(request, report_id):
    report = get_object_or_404(DailyReport, id=report_id)
    # Return as plain text for simplicity, or use a template for a "PDF" look
    return HttpResponse(report.content, content_type="text/plain")