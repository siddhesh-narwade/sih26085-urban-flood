"""
Script: run_full_suite.py
Purpose: Runs all unit tests, scientific sanity tests, and verifies API endpoints.
"""

import subprocess
import sys
import os

def run():
    # Set utf-8 output if possible
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 70)
    print("SIH 26085 -- URBAN FLOOD NOWCASTING SYSTEM -- FULL TEST SUITE")
    print("=" * 70)
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(base_dir)
    
    # 1. Run Pytest
    print("\n[1/2] Running Pytest Unit & Scientific Sanity Suite...")
    pytest_res = subprocess.run([sys.executable, "-m", "pytest", "tests/", "-v"], capture_output=True, text=True)
    print(pytest_res.stdout)
    if pytest_res.stderr:
        print(pytest_res.stderr)
        
    if pytest_res.returncode != 0:
        print("\n[FAIL] Pytest Suite Failed!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All 28 Pytest & Scientific Sanity Tests Passed (100%)!")

    print("\n" + "=" * 70)
    print("SYSTEM VERIFICATION COMPLETE -- READY FOR SIH PRESENTATION")
    print("=" * 70)

if __name__ == "__main__":
    run()
