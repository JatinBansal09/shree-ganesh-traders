from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from my-app directory (parent of backend)
ENV_PATH = BASE_DIR.parent / '.env'
load_dotenv(ENV_PATH)

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# SECRET_KEY = 'django-insecure-0@!334ba(at)1gd4g0@fi^k)ppzsmigt)rh+8r_*toum*$x!uc'
SECRET_KEY = os.environ.get('SECRET_KEY')

# 1. Try to get the key from the environment
DJANGO_SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY')

# settings.py

TWILIO_ACCOUNT_SID     = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN      = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_NUMBER = os.environ.get('TWILIO_NUMBER')
OWNER_PHONE = os.environ.get('OWNER_PHONE')

# 2. If it's missing (None), check if we are in DEBUG mode
# if not SECRET_KEY:
#     if DEBUG:
#         DJANGO_SECRET_KEY = 'django-insecure-fallback-key-for-local-dev-only'
#     else:
#         # This stops the server from starting in production without a real key
#         raise ValueError("DJANGO_SECRET_KEY environment variable is not set!")
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']  # ✅ For Docker: allows all hosts

# ==================== APPLICATION DEFINITION ====================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'base',
    'channels',
    'django_apscheduler',
]

# Replace WSGI with ASGI
ASGI_APPLICATION = 'backend.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            # "hosts": [("127.0.0.1", 6379)],
            "hosts": [os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")],
        },
    },
}

# ==================== MIDDLEWARE ====================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # Session comes first
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'base.middleware.AutoLogoutMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ==================== REST FRAMEWORK ====================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'base.authentication.CsrfExemptSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',  # Global auth requirement
    ],
    # Custom exception handler to ensure 401 for expired sessions
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
}

ROOT_URLCONF = 'backend.urls'

# ==================== TEMPLATES ====================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# ==================== DATABASE ====================
DATABASES = {
    'default': {
        'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.mysql'),
        'HOST': os.environ.get('DB_HOST', 'localhost'), 
        'NAME': os.environ.get('DB_NAME', 'shreeganesh'),
        'USER': os.environ.get('DB_USER', 'root'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'Admin123@###'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    }
}

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'HOST': 'localhost',
#         'USER': 'root',
#         'PASSWORD': 'Admin123@###',
#         'NAME': 'shreeganesh',
#         'PORT': '3306',
#         'OPTIONS': {
#             'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
#         }
#     }
# }

# ==================== PASSWORD VALIDATION ====================
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ==================== INTERNATIONALIZATION ====================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ==================== CORS & CSRF SETTINGS ====================
# CORS Configuration
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",        # ✅ Docker nginx
    "http://localhost:80",     # ✅ Docker nginx explicit port
]

CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']

# CSRF Configuration
# CSRF_TRUSTED_ORIGINS = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",        # ✅ Docker nginx
    "http://localhost:80",
]

CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_HTTPONLY = False  # Frontend needs to read this
CSRF_COOKIE_SECURE = False  # True in production with HTTPS
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False  # Keep as cookie for frontend access

# ==================== SESSION SETTINGS ====================
# Session Configuration - CRITICAL FOR AUTO-LOGOUT!
SESSION_ENGINE = 'django.contrib.sessions.backends.db'  # Store in MySQL
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_AGE = 24*3600  # 24 hours - keeps cookie alive on browser (backend timeout handled separately)
SESSION_SAVE_EVERY_REQUEST = True  # MUST BE FALSE for timed expiry to work!
SESSION_EXPIRE_AT_BROWSER_CLOSE = False  # Use time-based expiry, not browser session
SESSION_COOKIE_HTTPONLY = True  # JavaScript can't access (security)
SESSION_COOKIE_SECURE = False  # True in production with HTTPS
SESSION_COOKIE_SAMESITE = 'Lax'

# Custom setting: Backend session timeout (independent from cookie Max-Age)

# Clear session when user logs out
SESSION_CLEAR_ON_LOGOUT = True

# ==================== SECURITY SETTINGS ====================
# In production, set these to True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ==================== STATIC FILES ====================
STATIC_URL = 'static/'
STATICFILES_DIRS = [
    BASE_DIR / "static",
]
STATIC_ROOT = BASE_DIR / 'staticfiles'

# ==================== DEFAULT AUTO FIELD ====================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==================== LOGGING (Optional, for debugging) ====================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'base': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Set to DEBUG to see your app logs
        },
    },
}