from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stock_register', '0003_alter_apparatusitem_make_alter_chemicalitem_make_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='chemicalitem',
            old_name='quantity_ml',
            new_name='quantity',
        ),
        migrations.AddField(
            model_name='chemicalitem',
            name='unit',
            field=models.CharField(
                choices=[('ml', 'mL'), ('g', 'g')],
                default='ml', max_length=2,
            ),
        ),
        migrations.AddField(
            model_name='stockregister',
            name='remarks',
            field=models.TextField(blank=True, default=''),
        ),
    ]
