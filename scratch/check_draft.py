import os
import requests

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

res = requests.get(
    f"{url}/rest/v1/widget_preview_drafts?select=payload,revision&order=created_at.desc&limit=1",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
)
print(res.json())
