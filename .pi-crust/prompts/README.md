# Prompts

Every Activity's prompts ship with pi-crust. This directory is for yours.

## Overriding one

Point the Activity at your file in `config/crust.activities.yaml`:

```yaml
- name: plan
  prompts:
    system: .pi-crust/prompts/plan/system.md
```

A key you do not mention keeps the shipped prompt, so overriding the system prompt alone leaves the user prompt as it was.

## Overriding the revise prompt

Set `prompts.revise` for `build` in `config/crust.activities.yaml`:

```yaml
- name: build
  prompts:
    revise: prompts/build/custom-revise.md
```

Create that file under `.pi-crust/`. A revise round renders it instead of the user prompt, then appends steering and the blocking findings from review. Leaving the key out keeps the shipped revise prompt.

## Adding one

An Activity you register yourself names its prompts the same way. There is no registry of prompts and no naming rule — the path in the configuration is the whole mechanism.
