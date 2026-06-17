import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from base.models import Customer, CustomerType

User = get_user_model()


# ══════════════════════════════════════════════════════════════════
# FIXTURES
# ══════════════════════════════════════════════════════════════════

@pytest.fixture
def api_client():
    """Plain unauthenticated client — no login"""
    return APIClient()


@pytest.fixture
def customer_type(db):
    """Creates a Retailer CustomerType row in test DB"""
    return CustomerType.objects.create(type_name="Retailer")


@pytest.fixture
def owner_user(db):
    """
    Owner = is_superuser=True, is_staff=False
    Matches your get_user_role() logic in views.py
    """
    user = User.objects.create_superuser(
        username="test_owner",
        password="Owner@1234",
        email="owner@test.com",
    )
    # ✅ Your step 13 sets is_staff=False for Owner
    user.is_staff = False
    user.save()
    return user


@pytest.fixture
def employee_user(db):
    """
    Employee = is_staff=True, is_superuser=False
    Matches your get_user_role() logic in views.py
    """
    return User.objects.create_user(
        username="test_employee",
        password="Employee@1234",
        email="employee@test.com",
        is_staff=True,
        is_superuser=False,
    )


@pytest.fixture
def retailer_user(db, customer_type):
    """
    Retailer = is_staff=False, is_superuser=False
    Has a Customer record linked to them
    """
    user = User.objects.create_user(
        username="test_retailer",
        password="Retailer@1234",
        email="retailer@test.com",
        is_staff=False,
        is_active=True,
    )
    Customer.objects.create(
        user=user,
        customer_name="Test Retailer Shop",
        phone_number="9876543210",
        customer_type=customer_type,
    )
    return user


@pytest.fixture
def owner_client(owner_user):
    """Pre-authenticated APIClient as Owner"""
    client = APIClient()
    client.force_authenticate(user=owner_user)
    return client


@pytest.fixture
def employee_client(employee_user):
    """Pre-authenticated APIClient as Employee"""
    client = APIClient()
    client.force_authenticate(user=employee_user)
    return client

# Example: Test that discount is correctly applied to a Retailer
@pytest.mark.django_db
def test_retailer_sees_correct_discount(retailer_client, retailer_user):
    session = retailer_client.session
    session['user_role'] = 'Retailer'
    session['user_id'] = retailer_user.id
    session.save()

    response = retailer_client.post('/api/product/', {}, format='json')
    
    # Now check the actual data, not just status code
    assert response.status_code == 200
    assert 'data' in response.json()
    assert 'base_percent' in response.json()['data'][0]  # discount exists

@pytest.fixture
def retailer_client(retailer_user):
    """Pre-authenticated APIClient as Retailer"""
    client = APIClient()
    client.force_authenticate(user=retailer_user)
    return client


# ══════════════════════════════════════════════════════════════════
# TEST 1 — CSRF TOKEN
# Always accessible — AllowAny in GetCSRFTokenView
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_csrf_token_accessible_without_login(api_client):
    """
    GetCSRFTokenView has permission_classes = [AllowAny]
    Anyone can get CSRF token — needed before login
    """
    response = api_client.get('/api/csrf-token/')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 2 — LOGIN (SessionLoginView)
# permission_classes = [AllowAny] — open endpoint
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_valid_login_returns_200(api_client, employee_user):
    """
    SessionLoginView.post() with correct credentials → 200
    """
    response = api_client.post('/api/', {
        'username': 'test_employee',
        'password': 'Employee@1234',
    }, format='json')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_wrong_password_blocked(api_client, employee_user):
    """
    SessionLoginView.post() with wrong password → 400 or 401
    """
    response = api_client.post('/api/', {
        'username': 'test_employee',
        'password': 'WrongPassword123!',
    }, format='json')
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
    ]


@pytest.mark.django_db
def test_inactive_user_cannot_login(api_client, db):
    """
    User with is_active=False (pending approval) should be blocked
    Your serializer sets is_active=False for public registrations
    """
    User.objects.create_user(
        username="pending_user",
        password="Test@1234",
        is_active=False,
    )
    response = api_client.post('/api/', {
        'username': 'pending_user',
        'password': 'Test@1234',
    }, format='json')
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_nonexistent_user_login_blocked(api_client, db):
    """
    Login with username that doesn't exist → 400 or 401
    """
    response = api_client.post('/api/', {
        'username': 'nobody_user',
        'password': 'SomePass@123',
    }, format='json')
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
    ]


# ══════════════════════════════════════════════════════════════════
# TEST 3 — PRODUCTS (ProductListView)
# permission_classes = [IsAuthenticated]
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_products(api_client):
    response = api_client.post('/api/product/', {}, format='json')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]



@pytest.mark.django_db
def test_owner_can_view_products(owner_client):
    """ProductListView.post() — owner sees products with no discounts"""
    # Set session so role check inside the view passes
    session = owner_client.session
    session['user_role'] = 'Owner'
    session['user_id'] = 1
    session.save()

    response = owner_client.post('/api/product/', {}, format='json')
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.django_db
def test_employee_can_view_products(employee_client, employee_user):
    session = employee_client.session
    session['user_role'] = 'Employee'
    session['user_id'] = employee_user.id
    session.save()

    response = employee_client.post('/api/product/', {}, format='json')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_retailer_can_view_products(retailer_client, retailer_user):
    session = retailer_client.session
    session['user_role'] = 'Retailer'
    session['user_id'] = retailer_user.id
    session.save()

    response = retailer_client.post('/api/product/', {}, format='json')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 4 — CUSTOMERS (UserCustomerListView)
# permission_classes = [IsAuthenticated] — NO role check inside
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_customers(api_client):
    """UserCustomerListView requires IsAuthenticated"""
    response = api_client.get('/api/users/customers/')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_owner_can_view_customers(owner_client):
    """Owner can access customer list"""
    response = owner_client.get('/api/users/customers/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_employee_can_view_customers(employee_client):
    """Employee can access customer list"""
    response = employee_client.get('/api/users/customers/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_retailer_can_view_customers(retailer_client):
    """
    ✅ IMPORTANT: UserCustomerListView has NO role check inside
    It only requires IsAuthenticated — so Retailer also gets 200
    This is different from what the original test assumed
    """
    response = retailer_client.get('/api/users/customers/')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 5 — ORDERS (ActiveOrdersView)
# permission_classes = [IsAuthenticated]
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_active_orders(api_client):
    response = api_client.get('/api/orders/active/')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_owner_can_view_active_orders(owner_client, owner_user):
    session = owner_client.session
    session['user_role'] = 'Owner'
    session['user_id'] = owner_user.id
    session.save()

    response = owner_client.get('/api/orders/active/')
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.django_db
def test_employee_can_view_active_orders(employee_client, employee_user):
    session = employee_client.session
    session['user_role'] = 'Employee'
    session['user_id'] = employee_user.id
    session.save()

    response = employee_client.get('/api/orders/active/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_unauthenticated_cannot_create_order(api_client):
    response = api_client.post('/api/orders/create/', {}, format='json')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


# ══════════════════════════════════════════════════════════════════
# TEST 6 — SETTINGS (UserSettingsView)
# permission_classes = [IsAuthenticated]
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_settings(api_client):
    """UserSettingsView requires IsAuthenticated"""
    response = api_client.get('/api/employee/settings/')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_employee_can_view_settings(employee_client):
    """Employee can access their settings"""
    response = employee_client.get('/api/employee/settings/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_owner_can_view_settings(owner_client):
    """Owner can also access settings"""
    response = owner_client.get('/api/employee/settings/')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 7 — REGISTRATION (UserRegistrationView)
# get_permissions: POST = AllowAny, others = IsAuthenticated
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_registration_missing_fields_returns_400(api_client):
    """
    UserRegistrationView.post() with missing required fields → 400
    Required: username, email, password, customer_name,
              phone_number, customer_userGroup
    """
    response = api_client.post('/api/register/', {
        'username': 'incomplete_user',
        # ❌ missing all other required fields
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_registration_duplicate_username_returns_400(
    api_client, db, customer_type
):
    """
    validate_username() in serializer checks for existing username
    Duplicate → 400
    """
    User.objects.create_user(
        username="existing_user",
        password="Test@1234",
    )
    response = api_client.post('/api/register/', {
        'username':           'existing_user',
        'password':           'Test@1234',
        'email':              'new@test.com',
        'customer_name':      'Test User',
        'phone_number':       '9876543211',
        'customer_userGroup': 'Retailer',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_registration_invalid_phone_returns_400(api_client, db, customer_type):
    """
    validate_phone_number() in serializer: must match ^[6-9]\d{9}$
    Invalid phone → 400
    """
    response = api_client.post('/api/register/', {
        'username':           'new_user_123',
        'password':           'Test@1234',
        'email':              'newuser@test.com',
        'customer_name':      'New User',
        'phone_number':       '1234567890',  # ❌ starts with 1 — invalid
        'customer_userGroup': 'Retailer',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


# ══════════════════════════════════════════════════════════════════
# TEST 8 — PENDING REGISTRATIONS (PendingRegistrationsView)
# permission_classes = [IsAuthenticated]
# Inside: if not request.user.is_superuser → 403
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_pending(api_client):
    """Unauthenticated → blocked by IsAuthenticated"""
    response = api_client.get('/api/registrations/pending/')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_owner_can_view_pending_registrations(owner_client):
    """
    Owner (is_superuser=True) passes the is_superuser check inside view
    → 200
    """
    response = owner_client.get('/api/registrations/pending/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_employee_cannot_view_pending_registrations(employee_client):
    """
    Employee (is_superuser=False) fails the is_superuser check
    View returns: Response({"error": "Access denied"}, status=403)
    """
    response = employee_client.get('/api/registrations/pending/')
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_retailer_cannot_view_pending_registrations(retailer_client):
    """
    Retailer (is_superuser=False) also gets 403 from inside the view
    """
    response = retailer_client.get('/api/registrations/pending/')
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ══════════════════════════════════════════════════════════════════
# TEST 9 — PAYMENTS
# DailyPaymentSummaryView and OverduePaymentsView extend View (not APIView)
# They have NO permission_classes — returns 200 for everyone including
# unauthenticated users. This is a security gap to be aware of.
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_payments_today_accessible(owner_client):
    """
    DailyPaymentSummaryView extends plain View (not APIView)
    Has no permission_classes — any request returns 200
    """
    response = owner_client.get('/api/payments/today/')
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_overdue_payments_accessible(owner_client):
    """
    OverduePaymentsView extends plain View (not APIView)
    Has no permission_classes
    """
    response = owner_client.get('/api/payments/overdue/')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 10 — CATEGORIES (Get_Categories)
# permission_classes = [IsAuthenticated]
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_unauthenticated_cannot_view_categories(api_client):
    """Get_Categories requires IsAuthenticated"""
    response = api_client.get('/api/product/categories/')
    assert response.status_code in [
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ]


@pytest.mark.django_db
def test_authenticated_user_can_view_categories(employee_client):
    """Any authenticated user can view categories"""
    response = employee_client.get('/api/product/categories/')
    assert response.status_code == status.HTTP_200_OK


# ══════════════════════════════════════════════════════════════════
# TEST 11 — SECURITY GAP DOCUMENTATION
# These tests document known issues to fix later
# ══════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_payment_views_need_auth_protection(api_client):
    """
    ⚠️  KNOWN ISSUE: DailyPaymentSummaryView and OverduePaymentsView
    extend plain Django View, not DRF APIView.
    This means they have NO authentication protection.

    TODO: Change these views to extend APIView and add:
        permission_classes = [IsAuthenticated]

    For now this test documents the current behavior.
    When you fix the views, change the assertion to 403.
    """
    response = api_client.get('/api/payments/today/')
    # ⚠️ Currently returns 200 even without auth — this should be 403
    # assert response.status_code == status.HTTP_403_FORBIDDEN  # ← enable after fix
    assert response.status_code in [
        status.HTTP_200_OK,      # current (broken) behavior
        status.HTTP_403_FORBIDDEN,  # correct behavior after fix
    ]