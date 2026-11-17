# Security

## Reporting a problem

Please report a security problem privately, not in a public issue:

- with **Report a vulnerability** in the [Security tab](https://github.com/pixelcake-dev/pixelcake/security) of the repository, or
- by writing to pixelcake.dev@gmail.com, with "Security" in the subject.

Say what an attacker could do, and the steps or the file that show it. You will have an answer within a week. Once a fix is published the report can be made public, with credit to you if you wish.

## What is worth reporting

PixelCake runs entirely in the browser: there is no server of its own, no account and no database, and the app sends nothing anywhere. What it stores stays in the storage of your browser, and what it saves is a file on your disk. The places where it trusts outside input are the files it opens:

- a project file (`.pixelcake.json`) or a YAML file opened from File, which could make the page run a script, reach another host or hang the browser;
- the names, notes and other texts inside them, which are shown on the board, in the windows, in the terminal and in an exported image.

A problem in the documentation pages or in the site, at https://pixelcake.dev, is welcome too.

## Versions

Only the latest version, the one published at https://app.pixelcake.dev from the `main` branch, receives fixes.
