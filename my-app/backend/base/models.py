from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
import uuid

class UserSession(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=40, null=True, blank=True)
    device_fingerprint = models.CharField(max_length=500, db_index=True, blank=False, null=False)
    logged_in_at = models.DateTimeField(null=True, blank=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)
    hashed_user_id = models.CharField(max_length=64, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} Session"

class PendingRegistration(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user        = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pending_registration'
    )
    customer    = models.OneToOneField(
        'Customer',
        on_delete=models.CASCADE,
        related_name='pending_registration'
    )
    status      = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    review_note  = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.customer.customer_name} — {self.status}"
    
class Customer(models.Model):
    # Customer_Id is handled automatically as 'id' by Django (primary key, increment)
    customer_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=15)
    gst_id = models.CharField(max_length=50, blank=True, null=True)
    customer_address = models.TextField(blank=True, default="")

    # Foreign Key Relationships
    # Ref: Customer.User_Id > Auth_User.id
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customers')
    
    # Assuming these tables exist elsewhere in your models.py
    # Ref: Customer.Reward_Id > Reward.Reward_Id
    reward = models.ForeignKey('Reward', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Ref: Customer.Type_Id > Customer_Type.Type_Id
    customer_type = models.ForeignKey('CustomerType', models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.customer_name

class CustomerType(models.Model):
    # Django automatically creates an 'id' (pk, increment) field. 
    # If you must name it Type_Id specifically, use primary_key=True.
    type_id = models.AutoField(primary_key=True)
    type_name = models.CharField(
        max_length=100, 
        help_text="Retailer, Plumber, Builder, Dealer, etc."
    )

    def __str__(self):
        return self.type_name

class Reward(models.Model):
    reward_id = models.AutoField(primary_key=True)
    reward_type = models.CharField(max_length=100)
    reward_points = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.reward_type} ({self.reward_points} pts)" 

class ProductCategory(models.Model):
    category = models.CharField(max_length=100)

    def __str__(self):
        return self.category

class ProductSubCategory(models.Model):
    sub_category = models.CharField(max_length=100)
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.CASCADE,
        related_name="sub_categories"
    )

    def __str__(self):
        return f"{self.sub_category} ({self.category})"

class ProductBrand(models.Model):
    brand = models.CharField(max_length=100)

    def __str__(self):
        return self.brand

class BrandSubCategoryMap(models.Model):
    brand = models.ForeignKey(
        ProductBrand, 
        on_delete=models.CASCADE, 
        related_name="subcategory_mappings"
    )
    sub_category = models.ForeignKey(
        ProductSubCategory, 
        on_delete=models.CASCADE, 
        related_name="brand_mappings"
    )

    class Meta:
        # Prevents duplicate mapping of the same brand to the same sub-category
        unique_together = ('brand', 'sub_category')

    def __str__(self):
        return f"{self.brand.brand} -> {self.sub_category.name}"

class ProductUnit(models.Model):
    name = models.CharField(max_length=20, unique=True) # e.g., "pcs", "box"

    def __str__(self):
        return self.name

class Product(models.Model):
    product_name = models.CharField(max_length=200)
    price = models.FloatField()

    size = models.CharField(max_length=50, blank=True, null=True)
    product_color = models.CharField(max_length=50, blank=True, null=True)
    product_description = models.TextField(blank=True, null=True)

    current_stock = models.IntegerField(default=0)

    capacity = models.CharField(max_length=50, blank=True, null=True)
    warranty = models.CharField(max_length=50, blank=True, null=True)
    max_head = models.IntegerField()

    unit = models.ForeignKey(
        ProductUnit, 
        on_delete=models.SET_NULL, # If a unit is deleted, don't delete the product
        null=True, 
        blank=True,
        related_name='products'
    )

    material = models.ForeignKey(
        'ProductMaterial', 
        on_delete=models.SET_NULL, # If a material is deleted, don't delete the product
        null=True, 
        blank=True,
        related_name='products'
    )

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT
    )
    sub_category = models.ForeignKey(
        ProductSubCategory,
        on_delete=models.PROTECT
    )
    brand = models.ForeignKey(
        ProductBrand,
        on_delete=models.PROTECT
    )
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.product_name
 
# TABLE 1: The Master Group Name
class DiscountGroup(models.Model):
    disc_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True, help_text="e.g., Retailers Gold")
    base_percent = models.FloatField(default=0.0)

    def __str__(self):
        return self.name
    
class UserGroupDiscountProfile(models.Model):
    # The Category/Group (e.g., Retailer, Builder, Plumber)
    customer_type = models.ForeignKey(
        'CustomerType', 
        on_delete=models.CASCADE,
        related_name="type_discounts"
    )
    
    # The Discount Rules applied to that category
    discount_group = models.ForeignKey(
        'DiscountGroup', 
        on_delete=models.CASCADE,
        related_name="group_types"
    )

    class Meta:
        # Prevents duplicate mapping of the same discount to the same type
        unique_together = ('customer_type', 'discount_group')
        verbose_name = "Group Discount Mapping"

    def __str__(self):
        return f"{self.customer_type.type_name} -> {self.discount_group.name}"

class CustomerDiscountGroup(models.Model):
    customer       = models.ForeignKey(Customer, on_delete=models.CASCADE)
    discount_group = models.ForeignKey(DiscountGroup, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('customer', 'discount_group')

# TABLE 2: Relationship with Brands
class DiscountGroupBrandMap(models.Model):
    group = models.ForeignKey(DiscountGroup, on_delete=models.CASCADE, related_name='brand_links')
    brand = models.ForeignKey('ProductBrand', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('group', 'brand') # Prevents duplicate mapping

# TABLE 3: Relationship with Categories
class DiscountGroupCategoryMap(models.Model):
    group = models.ForeignKey(DiscountGroup, on_delete=models.CASCADE, related_name='category_links')
    category = models.ForeignKey('ProductCategory', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('group', 'category')

# TABLE 4: Relationship with Sub-categories
class DiscountGroupSubCategoryMap(models.Model):
    group = models.ForeignKey(DiscountGroup, on_delete=models.CASCADE, related_name='subcategory_links')
    sub_category = models.ForeignKey('ProductSubCategory', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('group', 'sub_category')

class ProductMaterial(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name
    
class CustomerDiscountMap(models.Model):
    # Mapping [pk, increment]
    map_id = models.AutoField(primary_key=True)

    # Ref: Customer_Discount_Map.Type_Id > Customer_Type.Type_Id
    customer_type = models.ForeignKey(
        'CustomerType', 
        on_delete=models.CASCADE, 
        related_name='type_discount_maps'
    )

    # Ref: Customer_Discount_Map.Disc_Id > Discount_Group.Disc_Id
    discount_group = models.ForeignKey(
        'DiscountGroup', 
        on_delete=models.CASCADE, 
        related_name='customer_maps'
    )

    class Meta:
        # Prevents duplicate mapping of the same discount to the same customer type
        unique_together = ('customer_type', 'discount_group')

    def __str__(self):
        return f"{self.customer_type.type_name} -> {self.discount_group.disc_grp}"

class Orders(models.Model):
    Order_Id = models.AutoField(primary_key=True)
    Order_date = models.DateTimeField(auto_now_add=True)
    Total_Amount = models.FloatField()

    actual_qty_packed = models.IntegerField(null=True, blank=True)

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    Status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # ── Payment fields ──────────────────────────────────────
    PAYMENT_STATUS_CHOICES = [
        ('full', 'Full Payment'),
        ('partial', 'Partial Payment'),
        ('due', 'Due / Unpaid'),
    ]
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='due'
    )

    amount_paid = models.FloatField(default=0.0)

    # Auto-calculated — don't set manually, use save()
    percentage_paid = models.FloatField(default=0.0)

    # Relationships
    Customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    Employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    def save(self, *args, **kwargs):
        # ✅ Auto-calculate percentage_paid before saving
        if self.Total_Amount and self.Total_Amount > 0:
            self.percentage_paid = round((self.amount_paid / self.Total_Amount) * 100, 2)
        else:
            self.percentage_paid = 0.0

        # ✅ Auto-set payment_status based on percentage
        if self.percentage_paid >= 100:
            self.payment_status = 'full'
        elif self.percentage_paid > 0:
            self.payment_status = 'partial'
        else:
            self.payment_status = 'due'

        super().save(*args, **kwargs)

    @property
    def months_since_order(self):
        # ✅ Computed on the fly — no need to store in DB
        from django.utils import timezone
        now = timezone.now()
        delta = (now.year - self.Order_date.year) * 12 + (now.month - self.Order_date.month)
        return max(0, delta)

    def __str__(self):
        return f"Order {self.Order_Id} - {self.Customer}"

class OrderItems(models.Model):
    # Item_Id int [pk, increment]
    Item_Id = models.AutoField(primary_key=True)
    
    # Order_Id int (Ref: Order_Items.Order_Id > Orders.Order_Id)
    Order = models.ForeignKey(
        'Orders', 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    
    # Product_Id int (Ref: Order_Items.Product_Id > Products.Product_Id)
    Product = models.ForeignKey(
        'Product', 
        on_delete=models.PROTECT
    )
    
    # Qty int
    Qty = models.IntegerField()

    Actual_Qty = models.IntegerField(null=True, blank=True)
    
    # MRP float
    MRP = models.FloatField()
    
    # Selling_Price float
    Selling_Price = models.FloatField()
    
    # Discount_Id int (Ref: Order_Items.Discount_Id > Discount_Groups.id)
    # Set to null=True if a discount isn't always applied
    Discount = models.ForeignKey(
        'DiscountGroup', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    # Line_Total float
    Line_Total = models.FloatField()

    def save(self, *args, **kwargs):
        # Business Logic: Automatically calculate Line_Total before saving
        self.Line_Total = self.Qty * self.Selling_Price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Item {self.Item_Id} (Order {self.Order_Id})"

class OrderAction(models.Model):
    # action_id int [pk, increment]
    action_id = models.AutoField(primary_key=True)

    # Ref: Order_Action.Conversation_Id > Conversations.Conversation_Id
    # Assuming 'Conversations' is the name of your model
    Conversation = models.ForeignKey(
        'Conversation',
        on_delete=models.CASCADE,
        related_name='order_actions'
    )

    # Ref: Order_Action.Order_Id > Orders.Order_Id
    Order = models.ForeignKey(
        'Orders',
        on_delete=models.CASCADE,
        related_name='actions'
    )

    # action_type varchar
    # Good practice to use choices for fixed types (e.g., 'approve', 'cancel', 'return_approved', 'return_rejected', 'order_packed', 'order_loaded', 'order_on_the_way', 'order_received')
    action_type = models.CharField(max_length=50)

    # reason text
    reason = models.TextField(null=True, blank=True)

    expected_delivery = models.DateTimeField(null=True, blank=True)
    
    # notes text
    notes = models.TextField(null=True, blank=True)

    # performed_by_type varchar (e.g., 'Owner', 'Employee', 'System')
    performed_by_type = models.CharField(max_length=50)

    # Ref: Order_Action.performed_by_id > Auth_User.id
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='performed_by_id'
    )

    # created_at datetime
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Action {self.action_id} - {self.action_type} on Order {self.Order_id}"

class Conversation(models.Model):
    Conversation_Id = models.AutoField(primary_key=True)
    
    title = models.CharField(max_length=255, blank=True, null=True)

    # status: open / closed / order forwarded/ chat forwarded
    status = models.CharField(max_length=20, default='open')
    
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    Order = models.ForeignKey(
        'Orders',
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='conversations',
    )
        
class ConversationParticipant(models.Model):
    Participant_id = models.AutoField(primary_key=True)
    user_type = models.CharField(max_length=50) # e.g., Customer, Employee, Owner
    role = models.CharField(max_length=50)      # e.g., Primary, Handler, Supervisor
    
    # Ref: Conversation_Participant.conversation_id > Conversations.Conversation_Id
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='participants'
    )
    
    # Ref: Conversation_Participant.user_id > Auth_User.id
    user = models.ForeignKey(
    settings.AUTH_USER_MODEL, 
    on_delete=models.CASCADE,
    related_name='conversation_participations'
    )

class Message(models.Model):

    Message_id = models.AutoField(primary_key=True)

    message_text = models.TextField()

    MESSAGE_TYPE_CHOICES = [
        ('text',             'Text'),
        ('order_request',    'Order Request'),
        ('order_received',    'Order Received'),
        ('system',           'System'),
        ('forwarded',        'Forwarded'),
        ('Order Accepted',   'order_accepted'),
        ('Rejected',         'Rejected'),
        ('return_request',   'Return Request'),
        ('return_approved',  'Return Approved'),
        ('return_rejected',  'Return Rejected'),
        ('payment_recorded', 'Payment Recorded'),   # ← ADD THIS LINE
    ]

    message_type = models.CharField(max_length=50, choices=MESSAGE_TYPE_CHOICES, default='text')
    sender_type = models.CharField(max_length=50)  # e.g., 'Customer', 'Employee', 'Owner', 'system'

    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    # Ref: Message.Conversation_Id > Conversations.Conversation_Id
    Conversation = models.ForeignKey(
        'Conversation',
        on_delete=models.CASCADE,
        related_name='messages'
    )

    # Ref: Message.Sender_id > Auth_User.id
    Sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    def __str__(self):
        return f"Message {self.Message_id} in Chat {self.Conversation_id} by {self.Sender}"

class Return(models.Model):
    Return_Id = models.AutoField(primary_key=True)

    # ✅ Linked to the original order
    Order = models.ForeignKey(
        'Orders',
        on_delete=models.CASCADE,
        related_name='returns'
    )

    # ✅ Linked to the specific item being returned
    Order_Item = models.ForeignKey(
        'OrderItems',
        on_delete=models.CASCADE,
        related_name='return_entries'
    )

    # ✅ Linked to the conversation where return was requested
    Conversation = models.ForeignKey(
        'Conversation',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='returns'
    )

    Return_Qty = models.IntegerField()
    Return_reason = models.CharField(max_length=255)
    Return_date = models.DateTimeField(auto_now_add=True)
    Note_text = models.TextField(null=True, blank=True)
 
    # ✅ Who requested the return (customer)
    Requested_By = models.ForeignKey(
        'Customer',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='return_requests'
    )

    # ✅ Who processed it (Employee/Owner)
    Processed_By = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True, blank=True,
        db_column='Processed_By',
        related_name='processed_returns'
    )

    # ✅ Status tracking
    RETURN_STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    status = models.CharField(
        max_length=20,
        choices=RETURN_STATUS_CHOICES,
        default='pending'
    )

    def __str__(self):
        return f"Return {self.Return_Id} for Item {self.Order_Item_Id}"

class ProductPackage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="packages"
    )
    package_name = models.CharField(max_length=100)
    units_per_package = models.PositiveIntegerField()
    sellable = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.product_name} - {self.package_name}"

class Stock(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE
    )
    qty_updated = models.IntegerField()
    order = models.ForeignKey(
        'Orders', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='stock_updates'
    )
    
    # Linked to a Return for stock additions (when items come back)
    return_entry = models.ForeignKey(
        'Return', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='stock_updates'
    )
    last_updated = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.product} | Qty: {self.qty_updated}"

class Payment(models.Model):
 
    PAYMENT_MODE_CHOICES = [
        ('cash',   'Cash'),
        ('cheque', 'Cheque'),
        ('neft',   'NEFT / Bank Transfer'),
        ('upi',    'UPI / Online'),
        ('other',  'Other'),
    ]
 
    payment_id   = models.AutoField(primary_key=True)
    order        = models.ForeignKey(
        'Orders',
        on_delete=models.CASCADE,
        related_name='payments'
    )
    amount       = models.FloatField()
    mode         = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES)
    note         = models.TextField(blank=True, null=True)
    recorded_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='recorded_payments'
    )
    recorded_at  = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"Payment {self.payment_id} — ₹{self.amount} for Order {self.order_id}"

class UserSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    # Notifications
    email_notifications  = models.BooleanField(default=True)
    order_alerts         = models.BooleanField(default=True)
    marketing_emails     = models.BooleanField(default=False)
    customer_messages    = models.BooleanField(default=True)
    system_notifications = models.BooleanField(default=True)
    low_stock_alerts     = models.BooleanField(default=True)

    # Alert config
    alert_sound          = models.BooleanField(default=True)
    vibration            = models.BooleanField(default=False)
    priority             = models.CharField(
        max_length=10,
        choices=[("high", "High"), ("medium", "Medium"), ("low", "Low")],
        default="high"
    )

    # Security
    two_factor           = models.BooleanField(default=False)
    session_timeout      = models.BooleanField(default=True)

    # Appearance
    dark_mode            = models.BooleanField(default=False)
    compact_view         = models.BooleanField(default=False)

    # Language
    language             = models.CharField(max_length=10, default="en")
    number_format        = models.CharField(max_length=20, default="en-IN")

    updated_at           = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.user.username}"

class DailyReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report {self.created_at}"

class Inquiry(models.Model):
    # Using 'id' is standard Django practice (it's the pk)
    company_name = models.CharField(max_length=255)
    inquiry_type = models.CharField(max_length=100) # e.g., Dealer, Retailer
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True) # Always good to know WHEN they contacted you

    class Meta:
        verbose_name_plural = "Inquiries"

    def __str__(self):
        return f"{self.company_name} ({self.inquiry_type})"