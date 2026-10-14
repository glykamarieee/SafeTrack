from database import get_supabase


result = (
    get_supabase()
    .table("location_logs")
    .select("*")
    .limit(5)
    .execute()
)


print(result.data)