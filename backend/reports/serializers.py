from rest_framework import serializers


class YearEndReportSerializer(serializers.Serializer):
    academic_year = serializers.CharField()
    date_range = serializers.DictField()
    summary = serializers.DictField()
    monthly_purchase_trend = serializers.ListField()
    top_used_chemicals = serializers.ListField()
    purchases = serializers.DictField()
    usage_by_class = serializers.ListField()
    damage_summary = serializers.DictField()
    current_stock = serializers.DictField()
    restock_recommendations = serializers.ListField()
