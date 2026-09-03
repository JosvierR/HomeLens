# Security

HomeLens is an experimental prototype and should not be used for safety-critical or certified HVAC decisions.

Please avoid committing secrets. Local environment values belong in `.env`; only `.env.example` is tracked.

If this project is connected to persistent user data later, the security baseline must include authentication, authorization, row-level access controls, input validation, rate limiting, audit logging, and explicit retention rules for captured home data.
