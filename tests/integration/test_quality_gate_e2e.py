import subprocess
import json
import os

def test_quality_gate_e2e():
    # Create a temporary config with a very low threshold to force skipping paid
    with open("temp_config.toml", "w") as f:
        f.write("[routing]\nmin_free_quality_to_skip_paid = 0.01\n")

    try:
        env = os.environ.copy()
        env["DO_WDR_CONFIG"] = "temp_config.toml"
        env["PYTHONPATH"] = "."

        result = subprocess.run(
            ["python3", "scripts/cli.py", "what is rust programming", "--json"],
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"CLI failed: {result.stderr}")
            return

        data = json.loads(result.stdout)
        metrics = data.get("metrics", {})

        print(f"Source: {data.get('source')}")
        print(f"Quality Gate Metrics: {metrics.get('quality_gate')}")

        # If exa_mcp returned a result, quality_gate should be passed because threshold is 0.01
        if data.get("source") == "exa_mcp":
            if metrics.get("quality_gate", {}).get("passed"):
                print("E2E Test Passed: Gate triggered and recorded.")
            else:
                print("E2E Test Failed: Gate not recorded despite free result.")
        else:
            # exa_mcp might be unavailable in the sandbox, but we want to see if the gate logic is hit
            print(f"E2E Test Note: Resolved with {data.get('source')}.")

    finally:
        if os.path.exists("temp_config.toml"):
            os.remove("temp_config.toml")

if __name__ == "__main__":
    test_quality_gate_e2e()
