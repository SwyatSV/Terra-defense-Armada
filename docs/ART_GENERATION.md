# Изображения кораблей

Использован встроенный инструмент `image_gen` по навыку `imagegen`. Источник дизайна — исходный `assets/references/fleet_final.png` из пакета. Сгенерированы отдельные PNG с настоящей прозрачностью; исходный лист и его манифест не изменялись. Копии результатов находятся в `public/assets/sprites/`.

Все восемь изображений просмотрены рядом с исходным листом; браузерные тесты проверяют загрузку, наличие прозрачных и непрозрачных пикселей. Клеточная геометрия независима от рисунка, `object-fit: contain` сохраняет пропорции. Поворот вертикальной модели выполняется CSS, попадания и уничтожение нанесены отдельным слоем.

Статус: изображения подключены для прототипа, окончательная художественная приёмка не завершена. Генерация сохраняет общие силуэты, но не гарантирует пиксельную идентичность деталям листа. У Монолита и Молота исходный PNG имеет холст 3:1 вместо требуемого производственного 4:1; он пропорционально вписан в полосу 4:1. У остальных тоже остаются прозрачные поля различной ширины. Нужен финальный экспорт с единым отступом и проверка точного вида сверху, башен, пушек и кабелей. Растяжение корпуса не применяется.

## Набор промптов

Первый вызов (hero_prototype), прозрачный фон, лист флота как reference:

> Use case: background-extraction. Create ONE production game sprite: HERO PROTOTYPE, the small white/gray ship in the TOP LEFT of the reference sheet. Preserve its approved design exactly: forked pointed nose, white armor, orange accents, cyan cockpit and engines. Strict orthographic top down, NO visible side faces. Isolate only this single ship fully, remove ALL background, grid, frames and labels. Genuine transparent background. Nose points RIGHT. Centered on square canvas, entire ship visible with 5% transparent safety margin. No text, no shadow outside ship, no other ships. This asset is hero_prototype.png for a 1x1 board cell. Save the result as a local image artifact and provide its local path.

Для остальных семи использован шаблон, по одному вызову на файл, `transparent_background=true` и тот же reference:

```text
Use case: background-extraction. Asset type: ONE isolated production spaceship sprite named {id}.png. Reference image is the approved fleet sheet. Subject: {detail} Strict orthographic TOP DOWN, no perspective or visible sides. Rotate whole ship so NOSE points RIGHT, including cockpit, weapons and engines. Center the entire ship on a wide canvas aspect ratio {ratio}, using about 90% width and 85% height, with transparent margin. Genuine transparent alpha background. No other ships, text, labels, grid, border, background or exterior shadow. Do not crop parts. Preserve silhouette and all design details. Make a clean game sprite suited to display in a single-cell-wide straight strip. Return local image artifact path.
```

| id | ratio | detail |
| --- | --- | --- |
| hero_twin | 2:1 | Second row LEFT ship TWIN: two massive white-gray cylindrical engines with orange bands, cyan coupling, rear small cyan cockpit attached by cables. Upper cannons near rear bases of engines. Preserve exact reference. |
| hero_bastion | 3:1 | Third row LEFT ship BASTION: white-gray armored hull, orange accents, cyan rear engines, top central gun turret, cyan cockpit, pointed front. Preserve exact reference. |
| hero_monolith | 4:1 | Bottom LEFT ship MONOLITH: long massive white-gray armored hull, orange accents, cyan engines, central cockpit, multiple top-mounted turrets. Preserve exact reference. |
| enemy_standard | 1:1 | TOP RIGHT ship STANDARD: small olive-green split claw hull, cyan cockpit, dark metal internal engine and gun. Preserve exact reference. |
| enemy_scorpion | 2:1 | Second row RIGHT ship SCORPION: olive-green angular nose with forward guns, cyan cockpit, narrow rear hull with LOW single long-barrel turret firing toward nose. NO rear wings. Preserve exact reference. |
| enemy_cascade | 3:1 | Third row RIGHT ship CASCADE: long olive-green hull, pointed cyan cockpit, red missile pods close to cockpit, twin cylindrical rear engines. Preserve exact reference. |
| enemy_hammer | 4:1 | Bottom RIGHT ship HAMMER: long heavy olive-green battleship, massive blunt striking nose, central cyan cockpit, multiple top turrets, cyan rear exhausts. Preserve exact reference. |
