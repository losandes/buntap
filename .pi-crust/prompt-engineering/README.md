# Prompts

Every Activity's prompts ship with pi-crust. This directory is for yours.

## Overriding one

Point the Activity at your file in `config/crust.activities.yaml`:

```yaml
- name: plan
  prompt_engineering:
    system: .pi-crust/prompt-engineering/plan/system.md
```

A key you do not mention keeps the shipped prompt, so overriding the system prompt alone leaves the user prompt as it was.

## Adding one

An Activity you register yourself names its prompts the same way. There is no registry of prompts and no naming rule — the path in the configuration is the whole mechanism.
