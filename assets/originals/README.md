# Drop originals here

Raw photos and scans go in this folder. Nothing here is committed and nothing
here is served — `pnpm images` reads from here and writes the versions the site
actually uses into `public/images/`.

## Why originals stay out of git

A photo taken on a phone carries EXIF, and EXIF carries GPS. A picture of a
certificate taken at a desk records the coordinates of that desk. BUILD_PLAN.md
§6 makes stripping it a requirement of the media pipeline for exactly this
reason, and a file committed here would put the original — GPS and all — into a
public repository permanently, whether or not the served copy is clean.

So this folder is in `.gitignore`, and the processed output in `public/images/`
is what ships. Keep your originals somewhere of your own as well: they are the
only copy, and `pnpm images` cannot regenerate what it never had.

## Naming

The file name becomes the served name, so use something durable:

```
assets/originals/amin.jpg                          → public/images/amin.{webp,avif}
assets/originals/certificates/aws-cloud-2025.jpg   → public/images/certificates/…
```

Lowercase, hyphens, no spaces, no dates in the name unless the date is part of
what the thing is.

## Running it

```
pnpm images
```

It reports what it read, what it wrote, and how much it saved. Run it again
whenever you add a file; existing outputs are overwritten, so it is safe to
repeat.
