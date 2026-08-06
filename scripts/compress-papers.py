from PIL import Image
from pathlib import Path

src = Path(r"D:\Random Projects\thecrazyphysicist369.github.io\papers")
out = src / "images"
out.mkdir(exist_ok=True)

for i in range(1, 7):
    p = src / f"{i}.png"
    im = Image.open(p).convert("RGB")
    print(f"{i}.png {im.size}")
    im.thumbnail((900, 1200), Image.Resampling.LANCZOS)
    dest = out / f"{i}.webp"
    im.save(dest, "WEBP", quality=82, method=6)
    print(f"  -> {dest.name} {im.size} {dest.stat().st_size / 1024:.0f} KB")
