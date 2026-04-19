"""E2B sandbox helpers for the Developer agent (install + pytest)."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from e2b import CommandExitException
from e2b.sandbox.commands.command_handle import CommandResult
from e2b_code_interpreter import Sandbox

load_dotenv()

# Ensure SDK sees the key (plan: load via python-dotenv)
os.environ.setdefault("E2B_API_KEY", os.getenv("E2B_API_KEY", ""))

SANDBOX_WORKDIR = "/home/user"
_CMD_TIMEOUT_SEC = 600.0


def _run_shell(sb: Sandbox, cmd: str, cwd: str, timeout: float = _CMD_TIMEOUT_SEC) -> CommandResult | CommandExitException:
    """Run a shell command; non-zero exit returns CommandExitException as a CommandResult-like object."""
    try:
        return sb.commands.run(cmd, cwd=cwd, timeout=timeout)
    except CommandExitException as exc:
        return exc


def _write_all_files(sb: Sandbox, code_files: dict[str, str]) -> None:
    for rel_path, body in code_files.items():
        path = rel_path if rel_path.startswith("/") else f"{SANDBOX_WORKDIR}/{rel_path.lstrip('./')}"
        sb.files.write(path, body)


def _empty_error_result(exc: BaseException) -> dict[str, Any]:
    print(f"[e2b_tools] {exc!r}")
    return {
        "stdout": "",
        "stderr": str(exc),
        "exit_code": 1,
        "install_output": "",
        "passed": False,
    }


def run_code_in_sandbox(code_files: dict[str, str]) -> dict[str, Any]:
    """
    Writes files, runs pip install -r requirements.txt -q, then pytest test_app.py -v --tb=short.
    Returns stdout/stderr/exit_code from the pytest step; install_output is pip output.
    """
    try:
        with Sandbox.create() as sb:
            _write_all_files(sb, code_files)

            install_r = _run_shell(
                sb,
                "pip install -r requirements.txt -q",
                cwd=SANDBOX_WORKDIR,
                timeout=_CMD_TIMEOUT_SEC,
            )
            install_output = f"{install_r.stdout}\n{install_r.stderr}".strip()

            test_r = _run_shell(
                sb,
                "pytest test_app.py -v --tb=short",
                cwd=SANDBOX_WORKDIR,
                timeout=_CMD_TIMEOUT_SEC,
            )
            passed = test_r.exit_code == 0
            return {
                "stdout": test_r.stdout,
                "stderr": test_r.stderr,
                "exit_code": test_r.exit_code,
                "install_output": install_output,
                "passed": passed,
            }
    except Exception as e:
        return _empty_error_result(e)


def write_and_run_command(code_files: dict[str, str], command: str) -> dict[str, Any]:
    """Same as run_code_in_sandbox but runs a custom shell command instead of pytest."""
    try:
        with Sandbox.create() as sb:
            _write_all_files(sb, code_files)

            install_r = _run_shell(
                sb,
                "pip install -r requirements.txt -q",
                cwd=SANDBOX_WORKDIR,
                timeout=_CMD_TIMEOUT_SEC,
            )
            install_output = f"{install_r.stdout}\n{install_r.stderr}".strip()

            run_r = _run_shell(sb, command, cwd=SANDBOX_WORKDIR, timeout=_CMD_TIMEOUT_SEC)
            passed = run_r.exit_code == 0
            return {
                "stdout": run_r.stdout,
                "stderr": run_r.stderr,
                "exit_code": run_r.exit_code,
                "install_output": install_output,
                "passed": passed,
            }
    except Exception as e:
        return _empty_error_result(e)


def validate_e2b_connection() -> bool:
    """Open a sandbox, run echo ok, return True if stdout contains 'ok'."""
    try:
        with Sandbox.create() as sb:
            result = _run_shell(sb, 'echo "ok"', cwd=SANDBOX_WORKDIR, timeout=60.0)
            return "ok" in (result.stdout or "")
    except Exception as e:
        print(f"[e2b_tools] validate_e2b_connection failed: {e!r}")
        return False


if __name__ == "__main__":
    result = validate_e2b_connection()
    print(f"E2B connection valid: {result}")
