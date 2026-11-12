# Set up the builders on a new Claude account

Paste the prompt below into a new chat on the other account (it needs the Gmail and Claude Code Remote connectors and access to the GitHub account that owns the repo).

~~~text
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot. I am moving the unattended builders to this account.
1. Attach the repo with add_repo (access push) and read docs/auto-run/RUNNER-PROMPTS.md from main (use gh api REST, no full clone needed).
2. Check with list_triggers that no "Otiyot ..." scheduled tasks exist on this account yet. If some exist, update them instead of creating duplicates.
3. Create four scheduled tasks (create_trigger, initiation human_request), copying each prompt EXACTLY and in full from the file, with exactly these names and schedules: "Otiyot Opus builder" `CRON_TZ=America/New_York 47 * * * *`; "Otiyot Sonnet builder" `CRON_TZ=America/New_York 17 1-23/2 * * *`; "Otiyot Fable builder" `CRON_TZ=America/New_York 52 0-21/3 * * *`; "Otiyot watchdog" `CRON_TZ=America/New_York 32 * * * *`. Push notifications on, email off for the watchdog; push on and email on for the three builders.
4. Then set each model with update_trigger (I explicitly ask for these models): Opus builder claude-opus-5-5, Sonnet builder claude-sonnet-5-5, Fable builder claude-fable-5-2, watchdog claude-haiku-5-5. Read back each result and confirm the model, schedule, enabled and next run.
5. Do not change state.json, docs or code: the progress lives on GitHub (branch auto-run-state, docs/progress.json) and the builders continue where the last account stopped. Tell me which task is next and who owns it.
6. Remind me to disable the four scheduled tasks on my previous account so two accounts never build at once.
~~~

Before switching, on the old account disable the four "Otiyot ..." scheduled tasks and wait about 45 minutes (or until no branch or claim shows activity) so a running build finishes or its claim goes stale.
