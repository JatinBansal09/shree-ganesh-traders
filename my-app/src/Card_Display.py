from django.contrib.auth.models import User

user1 = User.objects.get(id=1)
user2 = User.objects.get(id=2)


user1.username, user2.username = user2.username, user1.username

user1.save()
user2.save()