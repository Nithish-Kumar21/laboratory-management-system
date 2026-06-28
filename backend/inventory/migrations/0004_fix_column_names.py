from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_alter_availableapparatus_options_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='availablechemical',
            old_name='available_quantity_ml',
            new_name='quantity',
        ),
        migrations.AddField(
            model_name='availablechemical',
            name='unit',
            field=models.CharField(
                choices=[('ml', 'mL'), ('g', 'g')],
                default='ml', max_length=2,
            ),
        ),
        migrations.RenameField(
            model_name='lowstockchemical',
            old_name='current_quantity_ml',
            new_name='quantity',
        ),
        migrations.AddField(
            model_name='lowstockchemical',
            name='unit',
            field=models.CharField(
                choices=[('ml', 'mL'), ('g', 'g')],
                default='ml', max_length=2,
            ),
        ),
        migrations.AlterModelOptions(
            name='availableapparatus',
            options={'managed': False},
        ),
        migrations.AlterModelOptions(
            name='availablechemical',
            options={'managed': False},
        ),
        migrations.AlterModelOptions(
            name='labconfiguration',
            options={'managed': False},
        ),
        migrations.AlterModelOptions(
            name='lowstockapparatus',
            options={'managed': False},
        ),
        migrations.AlterModelOptions(
            name='lowstockchemical',
            options={'managed': False},
        ),
    ]
