# Atrapar la nube

**Proyecto Final Unidad 3 · Taller de Diseño de Interfaces**
Pieza audiovisual interactiva para el concurso **Chile Re-Descubre** (Congreso Futuro · ACHIPEC · CRTIC).

🔗 **Demo en línea:** https://juandomingoo.github.io/atrapar-la-nube/
🎬 **Cápsula audiovisual (1 min):** [ver video](PEGAR-AQUÍ-EL-LINK-DEL-VIDEO)

---

## Tema elegido

**Hito: Atrapanieblas**, del libro *Hecho en Chile. 50 ideas, descubrimientos e innovaciones*
(categoría Innovación Tecnológica, Ingeniería y Salud).

## Descripción conceptual

En el norte de Chile casi nunca llueve, pero casi todas las mañanas la **camanchaca**, una niebla espesa que llega desde el Pacífico, cubre los cerros de la costa. Sus gotas son tan livianas que flotan y no caen al suelo.

En 1956, durante una fuerte sequía en Antofagasta, el físico **Carlos Espinosa Arancibia** pensó que si la niebla no cae, hay que salir a atraparla. Su primer prototipo usaba hilos finos de perlón donde las gotas chocaban, se juntaban y escurrían hacia un estanque. La patente fue cedida a la **UNESCO** para que cualquier comunidad del mundo pudiera usar el invento libremente.

En *Atrapar la nube* el usuario toma el lugar de Espinosa. **Con su propia mano, frente a la cámara**, tiende la malla en el cerro, la gira hasta dejarla de frente al viento y cierra el puño para que el agua baje al estanque. Cuando el estanque se llena, el desierto florece. La interacción hace sentir la idea central del invento: el agua ya está en el aire y solo hay que saber dónde y cómo atraparla.

El relato avanza en 4 momentos que aparecen en pantalla:

1. **La camanchaca**: qué es la niebla costera.
2. **La idea de Espinosa**: la sequía de 1956 y el primer prototipo.
3. **El viento cambia**: a mitad de camino el viento gira y hay que reorientar la malla, igual que en la realidad, donde antes de instalar un atrapanieblas se estudia por dónde sopla el viento en cada cerro.
4. **El desierto florece**: el legado del invento y la patente cedida a la UNESCO.

## Instrucciones de uso e interacción

1. Abre la demo en **Chrome o Edge** en un computador con cámara.
2. Pulsa **Comenzar con cámara** y acepta el permiso. Si no tienes cámara, usa **Usar mouse**.
3. Ponte a unos 50–80 cm de la cámara, con buena luz y la mano a la vista.

| Gesto | Acción |
|---|---|
| ✋ Mano abierta (medio segundo) | Tiende la malla en el cerro |
| ↔️ Mover la mano a los lados | Gira la malla. La barra *Malla de frente al viento* muestra qué tan bien está orientada |
| ✊ Puño cerrado | Las gotas bajan por la malla y el tubo hasta el estanque |
| 🌬️ Cambio de viento | Cuando el estanque llega a la mitad, el viento gira: hay que encontrar el nuevo ángulo para seguir atrapando niebla |

En **modo mouse**: mover el mouse gira la malla y mantener el clic presionado equivale al puño.

**Atajos de teclado** (útiles para presentar y grabar):

| Tecla | Función |
|---|---|
| `R` | Reiniciar la experiencia |
| `M` | Silenciar o activar el sonido |
| `H` | Ocultar o mostrar la vista de la cámara |
| `F` | Llenar el estanque y saltar al final (para ensayos) |

> La cámara se procesa localmente en el navegador. No se graba ni se envía ninguna imagen.

## Tecnologías empleadas

- **MediaPipe Tasks Vision · Hand Landmarker** (v0.10.14): detecta y sigue 21 puntos de la mano en tiempo real. El gesto se calcula comparando la distancia de cada punta de dedo a la muñeca con la de su articulación media: con 3 o más dedos extendidos la mano está abierta, y con 1 o ninguno es un puño.
- **Three.js** (r160): escena 3D con terreno generado por código, malla, estanque, 2.000 partículas de niebla, gotas, tubo con agua y vegetación instanciada para el desierto florido. La captura es física simple: una partícula queda atrapada cuando cruza el plano de la malla, así que la malla solo atrapa niebla cuando está de frente al viento. La niebla se simula en el marco del viento, y al cambiar su dirección todo el campo de partículas gira alrededor del cerro.
- **Web Audio API**: todo el sonido se genera en código (viento, gotas, soplido y acorde final), sin archivos externos.
- **HTML, CSS y JavaScript** (módulos ES), sin compilación. Se publica directo en GitHub Pages.

## Estructura del proyecto

```
atrapar-la-nube/
├── index.html      # estructura, pantallas de inicio y cierre
├── css/style.css   # diseño de la interfaz (HUD, relato, botones)
├── js/main.js      # escena Three.js, lógica de la experiencia y relato
├── js/hand.js      # MediaPipe Hand Landmarker + respaldo con mouse
├── js/audio.js     # sonido generado con Web Audio
└── README.md
```

## Ejecutar en local

La cámara solo funciona desde `https://` o `localhost`. No funciona si abres el archivo con doble clic.

```bash
npx serve .
# o en VS Code: clic derecho en index.html → "Open with Live Server"
```

## Fuentes

- Libro *Hecho en Chile. 50 ideas, descubrimientos e innovaciones*, hito «Atrapanieblas».
- BBC Mundo (vía Cooperativa.cl), *Los atrapanieblas que capturan agua en Atacama*.
- FAO, *Capturar la niebla para obtener agua*.
- Universidad Católica del Norte / Ideassonline, *Los atrapanieblas de Chile*.

## Autor

Nombre Apellido · Taller de Diseño de Interfaces · 2026
