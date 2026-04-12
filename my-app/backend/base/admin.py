from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .forms import CustomUserCreationForm, CustomUserChangeForm
from .models import UserSession, Customer, CustomerType

class MyUserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Customer Information", {
            'classes': ('customer-info-section',),
            'fields': (
                'customer_name', 'phone_number', 'gst_id',
                'customer_address', 'customer_type'
            ),
        }),
    )

    add_fieldsets = (
        (None, {
            'fields': (
                'username', 'password1', 'password2',
                'is_staff', 'is_superuser',
                'customer_name', 'phone_number', 'gst_id',
                'customer_address', 'customer_type'
            ),
        }),
    )

    def get_fieldsets(self, request, obj=None):
        # Hide customer fields for staff/superusers
        if obj and (obj.is_staff or obj.is_superuser):
            return BaseUserAdmin.fieldsets
        return super().get_fieldsets(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        if obj and (obj.is_staff or obj.is_superuser):
            # Remove customer fields for staff/superusers
            for field in ['customer_name', 'phone_number', 'gst_id',
                          'customer_address', 'customer_type']:
                if field in form.base_fields:
                    form.base_fields.pop(field)
        else:
            # Populate initial values for non-staff users
            customer = Customer.objects.filter(user=obj).first() if obj else None
            if customer:
                initial_data = {
                    'customer_name': customer.customer_name,
                    'phone_number': customer.phone_number,
                    'gst_id': customer.gst_id,
                    'customer_address': customer.customer_address,
                    'customer_type': customer.customer_type,
                }
                for field, value in initial_data.items():
                    if field in form.base_fields:
                        form.base_fields[field].initial = value

        return form

    def get_add_fieldsets(self, request):
        """
        This controls the fields shown on the 'Add User' page.
        """
        # We start with the default Django User fields (Username, Passwords)
        fieldsets = (
            (None, {
                'classes': ('wide',),
                'fields': ('username', 'password1', 'password2', 'is_staff', 'is_superuser'),
            }),
        )
        
        # We add the customer fields to the bottom of the "Add" page.
        # Your 'user_admin_toggle.js' should hide this section 
        # automatically if 'is_staff' is checked.
        fieldsets += (
            ("Customer Information (Leave blank for Staff)", {
                'fields': ('customer_name', 'phone_number', 'customer_address', 'customer_type'),
            }),
        )
        return fieldsets

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        # Only create Customer for non-staff/non-superusers

        is_staff = form.cleaned_data.get('is_staff')
        
        # 2. If it IS staff, we stop. We don't touch the Customer table.
        # This prevents the 'Address Required' error because we never 
        # call Customer.objects.create()
        if is_staff or obj.is_superuser:
            # Map name/phone to User table before exiting
            obj.first_name = form.cleaned_data.get('customer_name') or ''
            obj.last_name = form.cleaned_data.get('phone_number') or ''
            obj.save()
            return
        
        if not (form.cleaned_data.get('is_staff') or form.cleaned_data.get('is_superuser')):
            if not change:  # only on creation
                customer_name = form.cleaned_data.get('customer_name')
                phone_number = form.cleaned_data.get('phone_number')
                customer_type = form.cleaned_data.get('customer_type')

                if customer_name and phone_number:
                    Customer.objects.create(
                        user=obj,
                        customer_name=customer_name,
                        phone_number=phone_number,
                        gst_id=form.cleaned_data.get('gst_id') or '',
                        customer_address=form.cleaned_data.get('customer_address') or '',
                        customer_type=customer_type,
                    )

    class Media:
        js = ('admin/js/user_admin_toggle.js',)


admin.site.unregister(User)
admin.site.register(User, MyUserAdmin)

@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    # Columns to show in the table list
    list_display = ('user', 'device_fingerprint', 'session_key', 'logged_in_at', 'logged_out_at')
    
    # Add filters on the right sidebar
    list_filter = ('logged_out_at', 'user')
    
    # Add a search bar
    search_fields = ('user__username', 'device_fingerprint')
    
    # Make these fields read-only to prevent manual tampering
    readonly_fields = ('logged_in_at',)

    # Custom column to show if session is currently active
    def is_active(self, obj):
        return obj.logged_out_at is None
    is_active.boolean = True  # Shows a nice Check/X icon


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    # Columns to display in the list view
    list_display = ('id', 'customer_name', 'phone_number', 'customer_type')
    
    # Clickable links to enter the edit page
    list_display_links = ('id', 'customer_name')
    
    # Add a search bar for specific fields
    search_fields = ('customer_name', 'phone_number', 'customer_address')
    
    # Add a filter sidebar on the right
    list_filter = ('customer_type', 'user') # Assuming you have a timestamp
    
    # Organize fields inside the edit form
    fieldsets = (
        ('Personal Information', {
            'fields': ('customer_name', 'phone_number')
        }),
        ('Business Details', {
            'fields': ('customer_type', 'customer_address')
        }),
    )

    # Optional: If you want the ID to be visible but not editable in the form
    readonly_fields = ('id',)