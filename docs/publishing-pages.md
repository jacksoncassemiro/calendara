# Documentation website

[Português](publishing-pages.pt-BR.md) · English

The public documentation and interactive playground can be hosted at `https://jacksoncassemiro.github.io/calendara/`. This URL becomes available only after the workflow is committed, pushed to `main`, and deployed successfully.

In repository Settings → Pages, choose **GitHub Actions** as the build/deployment source. Configure the `github-pages` environment to accept only `main`; add required review if your plan supports it. Review the first site build before deployment. A custom domain requires updating the site base and Pages/domain settings.

`.github/workflows/pages.yml` builds on `main` pushes or a manual dispatch from `main`. Its read-only job installs locked dependencies and builds with `MC_SITE_BASE=/calendara/`. It uploads only `dist/playground`, including the documentation home and demo. It rejects symlinks, logs, dotenv files and tarballs in that output. Local audit outputs, screenshots, repository history and package release assets are not uploaded.

The deployment job has only `pages: write` and `id-token: write`, with the `github-pages` environment. It executes the pinned official Pages action; it does not checkout source, install dependencies or execute project build scripts. No PR workflow or fork has deployment permissions. GitHub Pages visibility can differ from repository visibility; treat every bundled demo event and API example as public data.

The site is a static demo: events changed in it are not sent to a production backend. It is separate from the `.tgz` GitHub Release distribution and does not publish the library to npm.

Sources: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [deploy-pages](https://github.com/actions/deploy-pages), [environment protections](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
