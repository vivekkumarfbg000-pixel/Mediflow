"""Upload Mediflow Proactive Monitor files to Hugging Face Space."""
import os
import sys
import traceback

try:
    from huggingface_hub import HfApi
except ImportError:
    print("ERROR: huggingface_hub not installed", file=sys.stderr)
    sys.exit(1)

token = os.environ.get("HF_TOKEN", "").strip()
repo_id = os.environ.get("HF_PROACTIVE_SPACE_REPO", "").strip()

if not token:
    print("ERROR: HF_TOKEN environment variable is empty", file=sys.stderr)
    sys.exit(1)

if not repo_id:
    print("ERROR: HF_PROACTIVE_SPACE_REPO environment variable is empty", file=sys.stderr)
    sys.exit(1)

print(f"Uploading to HF Space: {repo_id}")
print(f"Token length: {len(token)}")

try:
    api = HfApi(token=token)
    api.upload_folder(
        folder_path="/tmp/hf-proactive-space",
        repo_id=repo_id,
        repo_type="space",
        commit_message="Deploy Mediflow proactive monitoring agent",
    )
    print("Upload complete!")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
