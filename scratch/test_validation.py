import requests

yaml_content_1 = """---
title: Mediflow Proactive Monitor
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
python_version: "3.10"
app_file: app.py
pinned: false
---"""

yaml_content_2 = """---
title: Mediflow Proactive Monitor
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
python_version: 3.10
app_file: app.py
pinned: false
---"""

def test_validate(content):
    print("Testing content:")
    print(content)
    try:
        url = "https://huggingface.co/api/validate-yaml"
        res = requests.post(url, data=content.encode("utf-8"), headers={"Content-Type": "text/plain"})
        print(f"Status Code: {res.status_code}")
        print(f"Content-type: {res.headers.get('Content-Type')}")
        print(f"Response Content: {res.text[:500]}")
    except Exception as e:
        print(f"Exception: {e}")
    print("-" * 40)

print("Test 1 (quoted 3.10):")
test_validate(yaml_content_1)

print("Test 2 (unquoted 3.10):")
test_validate(yaml_content_2)
