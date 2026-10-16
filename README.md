# Steven Widinata — About Me

> Curious Mind, Endless Possibilities

My personal website. It covers who I am, my journey from school to BINUS University, my projects and achievements, and what I want to explore next.

Built from scratch with plain HTML, CSS and JavaScript. There are no frameworks and no build step.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Customising

- **Project covers:** replace the files in `assets/covers/` with screenshots. Keep the same names, or update the `src` in `index.html`.
- **Indonesian text:** all translations live in `js/i18n.js`. English is the key, Indonesian is the value.
- **CV:** replace `assets/Steven_Widinata_CV.pdf`.
- **Share preview:** after deploying, change `og:image` in `index.html` to the full URL, for example `https://your-site.vercel.app/assets/profile.jpg`.

## Structure

```
index.html          page markup
css/style.css       styles (dark/light themes)
js/main.js          interactions
js/i18n.js          Indonesian translations
assets/             photo, CV, favicon, project covers
```
