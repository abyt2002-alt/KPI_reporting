"""
Quick test script for Gemini API
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.0-flash-exp")

if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in .env file")
    exit(1)

print(f"✅ API Key found: {GEMINI_API_KEY[:20]}...")
print(f"✅ Model: {GEMINI_MODEL}")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    
    print("\n🧪 Testing Gemini API...")
    response = model.generate_content("Say 'Hello from Gemini!' in JSON format: {\"message\": \"...\"}")
    print(f"✅ API Response: {response.text}")
    print("\n✅ Gemini API is working!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    exit(1)
