from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["email", "phone", "name", "role", "password", "metadata"]

    def validate_role(self, value):
        if value not in (User.Role.USER, User.Role.PROVIDER):
            raise serializers.ValidationError("Public registration only allows 'user' or 'provider' roles.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "phone", "name", "role",
            "avatar", "is_verified", "is_active", "metadata", "date_joined",
        ]
        read_only_fields = ["id", "email", "role", "is_verified", "is_active", "date_joined"]

