# TicketsIA_6-7

Sistema de Tickets de Soporte Técnico del Instituto Tecnológico de Veracruz. Clasifica tickets de soporte con Machine Learning y analiza su texto con PNL.

## Estructura

- [`front/`](front/): aplicación web con Vue 3, Vite y TypeScript.

## Front

Requiere Node `^22.18.0` o `>=24.12.0`. Todos los comandos se ejecutan dentro de `front/`.

```sh
cd front
npm install
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente |
| `npm run build` | Verifica tipos y compila para producción |
| `npm run preview` | Sirve localmente el build de producción |
| `npm run test:unit` | Ejecuta las pruebas unitarias con [Vitest](https://vitest.dev/) |
| `npm run lint` | Revisa y corrige el código con Oxlint y [ESLint](https://eslint.org/) |
| `npm run format` | Formatea `src/` con Prettier |

La configuración de Vite se documenta en la [referencia de Vite](https://vite.dev/config/).

### Entorno recomendado

- [VS Code](https://code.visualstudio.com/) con la extensión [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar), sin Vetur.
- Vue.js devtools para [navegadores Chromium](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) o [Firefox](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/), con Custom Object Formatter activado en [Chrome](http://bit.ly/object-formatters) o [Firefox](https://fxdx.dev/firefox-devtools-custom-object-formatters/).

### Tipos en archivos `.vue`

TypeScript no entiende los imports de `.vue` por sí solo, así que la verificación de tipos usa `vue-tsc` en lugar de `tsc`. En el editor, la extensión de Vue se encarga de lo mismo.
