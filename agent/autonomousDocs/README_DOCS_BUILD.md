Docs build & run instructions

1) Generate full navigation JSON from the existing `src/` folder:

   - Requires Node.js available on your PATH.
   - From repository root run:

```
node scripts/generateNav.js
```

   This will write `navigationConfig.json` containing a `nav` array describing the files under `src/`.

2) Serve the folder with a static server and open `index.html` in your browser.

   Example (using `http-server` from npm):

```
npx http-server . -p 8080
# then open http://localhost:8080
```

3) API contract (assumption):

   - The front-end calls `POST http://localhost:3030/api/vi/convertMdtohtml` with JSON body:

```
{ "path": "src/path/to/file.md" }
```

   - The endpoint should return an HTML string for that markdown file. The returned HTML will be inserted into the content area.

4) To show the Introduction page on load, `index.html` defaults to `src/README.md`. If you want a different initial file, edit the `initial` variable in the inline script of `index.html`.

5) CORS note: if the API runs on `localhost:3030` you may need to enable CORS on the API or serve the docs from the same origin.