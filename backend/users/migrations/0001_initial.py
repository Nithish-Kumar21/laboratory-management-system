from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False)),
                ('employee_id', models.CharField(
                    max_length=20,
                    unique=True,
                    validators=[
                        django.core.validators.RegexValidator(
                            regex='^[A-Za-z0-9]+$',
                            message='Employee ID must contain only letters and numbers'
                        )
                    ]
                )),
                ('full_name', models.CharField(max_length=100)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('phone', models.CharField(
                    max_length=13,
                    unique=True,
                    validators=[
                        django.core.validators.RegexValidator(
                            regex='^\\+91[0-9]{10}$',
                            message='Phone number must be in format: +91XXXXXXXXXX'
                        )
                    ]
                )),
                ('role', models.CharField(
                    max_length=20,
                    choices=[
                        ('HOD', 'Head of Department'),
                        ('Store Keeper', 'Store Keeper'),
                        ('Staff', 'Staff')
                    ]
                )),
                ('designation', models.CharField(max_length=50)),
                ('department', models.CharField(
                    max_length=30,
                    choices=[
                        ('B.Sc Chemistry', 'B.Sc Chemistry'),
                        ('M.Sc Chemistry', 'M.Sc Chemistry')
                    ]
                )),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('password_must_change', models.BooleanField(default=True)),
                ('last_password_change', models.DateTimeField(blank=True, null=True)),
                ('failed_login_attempts', models.IntegerField(default=0)),
                ('account_locked_until', models.DateTimeField(blank=True, null=True)),
                ('date_joined', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_users',
                    to='users.user'
                )),
                ('groups', models.ManyToManyField(
                    blank=True,
                    related_name='user_set',
                    to='auth.group'
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    related_name='user_set',
                    to='auth.permission'
                )),
            ],
            options={
                'db_table': 'user_account',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='PasswordResetToken',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reset_tokens',
                    to='users.user'
                )),
            ],
            options={
                'db_table': 'password_reset_token',
                'managed': False,
            },
        ),
    ]
