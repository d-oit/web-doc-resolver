# Capture Workflows

Reference for common screenshot capture workflows.

## Homepage Capture

```bash
#!/bin/bash
# capture-homepage.sh

URL="${1:-https://web-eight-ivory-29.vercel.app}"
OUTPUT="${2:-assets/screenshots/homepage.png}"

agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot "$OUTPUT"
agent-browser close

echo "✓ Captured: $OUTPUT"
```

## Full Page Capture

```bash
#!/bin/bash
# capture-full.sh

URL="${1:-https://web-eight-ivory-29.vercel.app}"
OUTPUT="${2:-assets/screenshots/homepage-full.png}"

agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot --full "$OUTPUT"
agent-browser close

echo "✓ Captured full page: $OUTPUT"
```

## Multi-Page Capture

```bash
#!/bin/bash
# capture-all-pages.sh

BASE_URL="${1:-https://web-eight-ivory-29.vercel.app}"
OUTPUT_DIR="${2:-assets/screenshots}"

PAGES=(
    "/:homepage.png"
    "/help:help-page.png"
)

for page in "${PAGES[@]}"; do
    IFS=':' read -r path filename <<< "$page"
    url="${BASE_URL}${path}"
    output="${OUTPUT_DIR}/${filename}"
    
    echo "Capturing: $url -> $output"
    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser screenshot "$output"
    agent-browser close
done

echo "✓ All pages captured"
```

## Release Capture

```bash
#!/bin/bash
# capture-release.sh

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUTPUT_DIR="assets/screenshots/release-v${VERSION}"

mkdir -p "$OUTPUT_DIR"

BASE_URL="${2:-https://web-eight-ivory-29.vercel.app}"

echo "Capturing release v${VERSION}..."

# Homepage
agent-browser open "$BASE_URL"
agent-browser wait --load networkidle
agent-browser screenshot "$OUTPUT_DIR/homepage.png"
agent-browser close

# Help page
agent-browser open "$BASE_URL/help"
agent-browser wait --load networkidle
agent-browser screenshot "$OUTPUT_DIR/help-page.png"
agent-browser close

# Annotated homepage
agent-browser open "$BASE_URL"
agent-browser wait --load networkidle
agent-browser screenshot --annotate "$OUTPUT_DIR/homepage-annotated.png"
agent-browser close

echo "✓ Release v${VERSION} screenshots saved to $OUTPUT_DIR"
```

## Flow Capture

```bash
#!/bin/bash
# capture-flow.sh

FLOW_NAME="${1:-resolve}"
BASE_URL="${2:-https://web-eight-ivory-29.vercel.app}"
OUTPUT_DIR="assets/screenshots/flow-${FLOW_NAME}"

mkdir -p "$OUTPUT_DIR"

case "$FLOW_NAME" in
    resolve)
        # Step 1: Open homepage
        agent-browser open "$BASE_URL"
        agent-browser wait --load networkidle
        agent-browser screenshot "$OUTPUT_DIR/01-homepage.png"
        
        # Step 2: Enter query
        agent-browser snapshot -i
        agent-browser fill @e5 "Rust async runtime"
        agent-browser screenshot "$OUTPUT_DIR/02-enter-query.png"
        
        # Step 3: Click resolve
        agent-browser click @e6
        agent-browser wait 3000
        agent-browser screenshot "$OUTPUT_DIR/03-resolving.png"
        
        agent-browser close
        ;;
    *)
        echo "Unknown flow: $FLOW_NAME"
        exit 1
        ;;
esac

echo "✓ Flow '$FLOW_NAME' captured to $OUTPUT_DIR"
```

## Viewport Variations

```bash
#!/bin/bash
# capture-responsive.sh

URL="${1:-https://web-eight-ivory-29.vercel.app}"
OUTPUT_DIR="${2:-assets/screenshots/responsive}"

mkdir -p "$OUTPUT_DIR"

VIEWPORTS=(
    "1920x1080:desktop"
    "1440x900:laptop"
    "768x1024:tablet"
    "375x812:mobile"
)

for vp in "${VIEWPORTS[@]}"; do
    IFS=':' read -r size name <<< "$vp"
    IFS='x' read -r width height <<< "$size"
    
    agent-browser set viewport "$width" "$height"
    agent-browser open "$URL"
    agent-browser wait --load networkidle
    agent-browser screenshot "$OUTPUT_DIR/${name}.png"
    agent-browser close
done

echo "✓ Responsive screenshots captured"
```

## Annotated Capture

```bash
#!/bin/bash
# capture-annotated.sh

URL="${1:-https://web-eight-ivory-29.vercel.app}"
OUTPUT="${2:-assets/screenshots/annotated.png}"

agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot --annotate "$OUTPUT"
agent-browser close

echo "✓ Annotated screenshot: $OUTPUT"
```
