import os
import sys
import urllib.request
import urllib.error
import json
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kguupaybvbngyzyofjun.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk"))
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def trigger_ai_forecast():
    print("──────────────────────────────────────────────────────────────────")
    print("⏰  MEDIFLOW CRON SCHEDULER: TRIGGERING SEASONAL AI FORECASTS")
    print("──────────────────────────────────────────────────────────────────\n")
    
    # 1. Fetch parameters from environments or use local enterprise demo defaults
    pharmacy_id = os.getenv("PHARMACY_ENTITY_ID", "dfb2a1a8-8e68-4f8a-929e-4a6c8e317003") # seeded pharmacy
    pod_id = os.getenv("POD_ID", "dfb2a1a8-8e68-4f8a-929e-4a6c8e317001") # seeded pod
    current_month = os.getenv("CURRENT_MONTH", "May")
    weather_alert = os.getenv("REGIONAL_WEATHER", "Pre-monsoon rainfall and high humidity levels")
    
    api_url = os.getenv("MEDIFLOW_API_URL", "http://localhost:8000/api/generate-seasonal-forecast")
    
    payload = {
        "pharmacy_entity_id": pharmacy_id,
        "pod_id": pod_id,
        "current_month": current_month,
        "regional_weather": weather_alert
    }
    
    print(f"📡  Dispatching POST request to local forecasting engine at {api_url}...")
    print(f"   - Pod ID: {pod_id}")
    print(f"   - Pharmacy Entity ID: {pharmacy_id}")
    print(f"   - Context: Month={current_month}, Weather={weather_alert}\n")
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        api_url, 
        data=data, 
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            
            if res_json.get("success"):
                print("🎉  [SUCCESS] AI Seasonal demand forecasts generated successfully!")
                print(f"    - Forecasts Created: {res_json.get('forecasts_created')}")
                for idx, forecast in enumerate(res_json.get("data", [])):
                    print(f"      {idx + 1}. Medicine: {forecast.get('medicine_name')} (+{forecast.get('suggested_increase_percentage')}%): {forecast.get('reason')}")
                sys.exit(0)
            else:
                print("❌  [ERROR] Forecast generation was not successful:")
                print(res_body)
                sys.exit(1)
                
    except urllib.error.URLError as e:
        print(f"❌  [URL Error] Failed to connect to Mediflow API: {e.reason}")
        print("    Ensure your FastAPI app is running on http://localhost:8000")
        sys.exit(1)
    except Exception as e:
        print(f"❌  [Unhandled Exception] An error occurred: {str(e)}")
        sys.exit(1)

def trigger_chronic_refills():
    print("──────────────────────────────────────────────────────────────────")
    print("⏰  MEDIFLOW CRON SCHEDULER: DISPATCHING CHRONIC WHATSAPP REFILLS")
    print("──────────────────────────────────────────────────────────────────\n")
    
    # 1. Setup API parameters
    api_url = os.getenv("MEDIFLOW_API_URL", "http://localhost:8000/api/whatsapp-send")
    
    # 2. Query active patient chronic holds from Supabase
    try:
        # Fetch inventory holds that are currently 'held' (reserved)
        res = supabase_client.table("inventory_holds").select("*").eq("hold_status", "held").execute()
        holds = res.data if res.data else []
        
        refills_sent = 0
        for hold in holds:
            # Check if hold expires/depletes in less than 3 days
            expiry_str = hold.get("expiry_date")
            if expiry_str:
                from datetime import datetime
                expiry_dt = datetime.strptime(expiry_str, "%Y-%m-%d")
                delta_days = (expiry_dt - datetime.now()).days
                
                # If running out in 3 days or less, trigger proactive refill warning
                if 0 <= delta_days <= 3:
                    phone = hold.get("patient_phone", "9876543210")
                    medicine = hold.get("medicine_name", "Metformin 500mg")
                    qty = hold.get("quantity", 60)
                    
                    payload = {
                        "phone": phone,
                        "message": (
                            f"🔔 *Mediflow Refill Alert* 💊\n\n"
                            f"Namaste. Aapki chronic tablet *{medicine}* agle 3 dino me khatam hone wali hai.\n\n"
                            f"Kya aap next month ka batch (*{qty} tablets*) order karna chahte hain? "
                            f"Clinic Pharmacy counter par dynamic 10% discount secure karne ke liye please replies me *REORDER* likhein. "
                            f"Aapki direct split receipt register ho jayegi! 🟢"
                        )
                    }
                    
                    data = json.dumps(payload).encode("utf-8")
                    req = urllib.request.Request(
                        api_url, 
                        data=data, 
                        headers={"Content-Type": "application/json"}
                    )
                    
                    with urllib.request.urlopen(req) as response:
                        res_body = response.read().decode("utf-8")
                        refills_sent += 1
                        print(f"📡  [Refill Sent] Alert dispatched to +91 {phone} for {medicine}.")
                        
        print(f"\n🎉  [SUCCESS] Chronic refills loop complete. Dispatched {refills_sent} notifications.")
        sys.exit(0)
    except Exception as e:
        print(f"❌  [Error] Failed to execute chronic refill scheduler loop: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--refills":
        trigger_chronic_refills()
    else:
        trigger_ai_forecast()
