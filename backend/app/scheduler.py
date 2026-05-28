import os
import sys
import urllib.request
import urllib.error
import json

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

if __name__ == "__main__":
    trigger_ai_forecast()
