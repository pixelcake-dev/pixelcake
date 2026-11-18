# Contributing to PixelCake

Thank you for looking. PixelCake is a small project with one maintainer, so the most useful contributions are the ones that are easy to check.

## What helps most

- **A bug report with the steps to see it.** Say what you did, what you expected and what happened. If it happens on a drawing of yours, a project file (File → Save) or a YAML export that shows it helps a lot; remove anything private from it first.
- **A correction to the documentation**, in English or Italian. The pages are in [documentation/](documentation/).
- **A wrong answer of the engine.** If PixelCake says a packet arrives where a real network would drop it, or the opposite, an issue with the drawing and the question is worth more than a patch: the engine is meant to stay a faithful, if simple, model, and some simplifications are deliberate (see "What it does not do" in the [README](README.md#what-it-does-not-do)).

For anything larger than a fix, **open an issue first** and describe what you would like to change. It saves you work if the change does not fit the direction of the project.

## Setting up

You need Node 22 or later and pnpm 10 (the checks on GitHub use Node 26).

```bash
cd frontend
pnpm install
pnpm dev          # the app at http://localhost:5173
pnpm docs:dev     # the documentation at http://127.0.0.1:5180/docs/, rebuilt at every save
```

## Before you open a pull request

```bash
cd frontend
pnpm lint
pnpm type-check
pnpm test:run     # the whole suite, documentation included
pnpm build
```

The same four steps run on every pull request, and a pull request is merged only when they pass.

Some things the suite checks that are easy to miss:

- **Two languages.** Every text of the interface lives in the dictionaries, `frontend/src/i18n/it` (the source) and `frontend/src/i18n/en`. A sentence written straight into a component fails a test. A new text needs both languages.
- **The engine is plain TypeScript.** `frontend/src/engine/` does not import React or the stores, and the same drawing always gives the same answer. A change to what the engine decides comes with a test that shows it.
- **The documentation is tested.** Every terminal example in it is run on the network it names and must print what the page shows, and every control it quotes must exist with that label. If your change alters what the app shows or prints, update the pages in both languages; [documentation/WRITING.md](documentation/WRITING.md) explains how, and `pnpm docs:test` runs these checks alone.

Commit messages say what the change does, in a plain sentence: "The terminal refuses a VLAN outside 1–4094".

## The contributor licence agreement

Before a pull request can be merged, its author accepts the [Contributor Licence Agreement](CLA.md) by ticking its box in the description of the pull request. You accept it once; it then covers your later contributions too.

In short: you keep the copyright of what you write, and you give the maintainer a licence to publish it in PixelCake under the AGPL or under other licences. This keeps open the possibility of offering PixelCake under other terms, for example to a company that cannot use the AGPL. What is published under the AGPL stays available under the AGPL. The agreement itself is short and in plain English: please read it.

## Conduct

Be kind and specific, and assume good faith. The [code of conduct](CODE_OF_CONDUCT.md) says the rest.

## Security

Please do not report a security problem in a public issue: [SECURITY.md](SECURITY.md) says how to report it privately.
