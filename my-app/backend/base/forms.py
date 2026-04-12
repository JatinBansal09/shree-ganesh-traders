from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomerType, Customer

class CustomUserCreationForm(UserCreationForm):
    is_staff = forms.BooleanField(required=False)
    is_superuser = forms.BooleanField(required=False)
    
    # Set these to False so they don't block Staff creation
    customer_name = forms.CharField(required=False)
    phone_number = forms.CharField(required=False)
    gst_id = forms.CharField(required=False)
    customer_address = forms.CharField(widget=forms.Textarea, required=False)
    customer_type = forms.ModelChoiceField(
        queryset=CustomerType.objects.all(), 
        required=False
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + (
            "is_staff", "is_superuser"
        )

    def clean(self):
        cleaned_data = super().clean()
        is_staff     = cleaned_data.get('is_staff')
        is_superuser = cleaned_data.get('is_superuser')

        if not is_staff and not is_superuser:
            if not cleaned_data.get('customer_name'):
                self.add_error('customer_name', 'Customer name is required.')
            if not cleaned_data.get('phone_number'):
                self.add_error('phone_number', 'Phone number is required.')
            if not cleaned_data.get('customer_type'):
                self.add_error('customer_type', 'Please select a customer type.')

        # Check for duplicate phone number
        phone = cleaned_data.get('phone_number')
        if phone and Customer.objects.filter(phone_number=phone).exists():
            self.add_error('phone_number', 'This phone number is already registered.')

        # Check for duplicate username
        username = cleaned_data.get('username')
        if username and User.objects.filter(username=username).exists():
            self.add_error('username', 'This username is already taken.')

        return cleaned_data
    
class CustomUserChangeForm(UserChangeForm):
    customer_name    = forms.CharField(required=False)
    phone_number     = forms.CharField(required=False)
    gst_id           = forms.CharField(required=False)
    customer_address = forms.CharField(widget=forms.Textarea, required=False)
    customer_type    = forms.ModelChoiceField(
        queryset=CustomerType.objects.all(),
        required=False
    )

    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        # Only enforce customer fields if not staff
        if not self.instance.is_staff and not self.instance.is_superuser:
            if not cleaned_data.get('customer_name'):
                self.add_error('customer_name', 'Customer name is required.')
            if not cleaned_data.get('phone_number'):
                self.add_error('phone_number', 'Phone number is required.')
        return cleaned_data
from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomerType, Customer

class CustomUserCreationForm(UserCreationForm):
    is_staff = forms.BooleanField(required=False)
    is_superuser = forms.BooleanField(required=False)
    
    # Set these to False so they don't block Staff creation
    customer_name = forms.CharField(required=False)
    phone_number = forms.CharField(required=False)
    gst_id = forms.CharField(required=False)
    customer_address = forms.CharField(widget=forms.Textarea, required=False)
    customer_type = forms.ModelChoiceField(
        queryset=CustomerType.objects.all(), 
        required=False
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + (
            "is_staff", "is_superuser"
        )

    def clean(self):
        cleaned_data = super().clean()
        is_staff     = cleaned_data.get('is_staff')
        is_superuser = cleaned_data.get('is_superuser')

        if not is_staff and not is_superuser:
            if not cleaned_data.get('customer_name'):
                self.add_error('customer_name', 'Customer name is required.')
            if not cleaned_data.get('phone_number'):
                self.add_error('phone_number', 'Phone number is required.')
            if not cleaned_data.get('customer_type'):
                self.add_error('customer_type', 'Please select a customer type.')

        # ✅ Check for duplicate phone number
        phone = cleaned_data.get('phone_number')
        if phone and Customer.objects.filter(phone_number=phone).exists():
            self.add_error('phone_number', 'This phone number is already registered.')

        # ✅ Check for duplicate username
        username = cleaned_data.get('username')
        if username and User.objects.filter(username=username).exists():
            self.add_error('username', 'This username is already taken.')

        return cleaned_data
    
class CustomUserChangeForm(UserChangeForm):
    customer_name    = forms.CharField(required=False)  # ✅ False, handle in clean()
    phone_number     = forms.CharField(required=False)
    gst_id           = forms.CharField(required=False)
    customer_address = forms.CharField(widget=forms.Textarea, required=False)
    customer_type    = forms.ModelChoiceField(
        queryset=CustomerType.objects.all(),
        required=False
    )

    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        # ✅ Only enforce customer fields if not staff
        if not self.instance.is_staff and not self.instance.is_superuser:
            if not cleaned_data.get('customer_name'):
                self.add_error('customer_name', 'Customer name is required.')
            if not cleaned_data.get('phone_number'):
                self.add_error('phone_number', 'Phone number is required.')
        return cleaned_data