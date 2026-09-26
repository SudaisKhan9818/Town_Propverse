import os

file_path = "app/globals.css"

with open(file_path, "rb") as f:
    content = f.read()

# The file might have null bytes (UTF-16 LE) from the append.
# Let's decode it safely, ignoring errors or removing null bytes.
text = content.decode('utf-8', errors='ignore').replace('\x00', '')

# Split by lines
lines = text.split('\n')
# Find the line with @media (max-width: 768px) and stop after its closing brace
# which is the original line 98.
clean_lines = lines[:98]

new_css = """
.hero-section {
  position: relative;
  min-height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.hero-bg-wrapper {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-bg-wrapper .bungalow-stage {
  height: 100%;
  min-height: 100vh;
  width: 100%;
  max-width: none;
  animation: stage-breathe 8s ease-in-out infinite;
  transform-style: preserve-3d;
  border-radius: 0;
}

.hero-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rem;
  padding: 6rem 5vw 2rem;
  color: #fffaf2;
  text-shadow: 0 2px 24px rgba(0,0,0,0.8);
}

.hero-copy h1 {
  color: #fffaf2;
}

.hero-content .eyebrow {
  color: #fffaf2;
  text-shadow: 0 2px 14px rgba(0,0,0,0.8);
}

.hero-content em {
  color: #fffaf2;
}

.hero-under {
  position: relative;
  top: auto;
  right: auto;
  left: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2rem;
}

.hero-under p {
  text-align: center;
  color: #fffaf2;
  text-shadow: 0 2px 14px rgba(0,0,0,0.8);
}

.desktop-nav a {
  color: rgba(255,255,255,0.8);
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.desktop-nav a:hover {
  color: #fff;
}

.wordmark {
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.site-nav.is-scrolled .wordmark {
  color: var(--foreground);
  text-shadow: none;
}

.site-nav.is-scrolled .desktop-nav a {
  color: var(--muted-foreground);
  text-shadow: none;
}

.site-nav.is-scrolled .desktop-nav a:hover {
  color: var(--foreground);
}

.feature-item button:hover {
  background: var(--clay) !important;
  color: #fffaf2 !important;
}

.hero-content .primary-action {
  background: var(--clay);
  color: #fffaf2;
}

.hero-content .primary-action:hover {
  background: #954221;
}

.hero-content .text-action {
  color: #fffaf2;
  text-shadow: 0 2px 14px rgba(0,0,0,0.8);
  border-bottom-color: rgba(255,255,255,0.5);
}

.hero-scroll-note {
  color: rgba(255,255,255,0.7);
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

@media (max-width: 768px) {
  .hero-content {
    padding-top: 9rem;
    padding-bottom: 5rem;
  }
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write("\n".join(clean_lines))
    f.write(new_css)
