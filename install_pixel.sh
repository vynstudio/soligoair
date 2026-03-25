#!/bin/bash
# Soligo Air — Meta Pixel Installer
# Run from: ~/Desktop/soligoair-shop/
# Usage: bash install_pixel.sh

PIXEL_ID="1231230569192614"
DIR=~/Desktop/soligoair-shop
PIXEL='  <!-- Meta Pixel Code -->\n  <script>\n  !function(f,b,e,v,n,t,s)\n  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?\n  n.callMethod.apply(n,arguments):n.queue.push(arguments)};\n  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='"'"'2.0'"'"';\n  n.queue=[];t=b.createElement(e);t.async=!0;\n  t.src=v;s=b.getElementsByTagName(e)[0];\n  s.parentNode.insertBefore(t,s)}(window, document,'"'"'script'"'"',\n  '"'"'https://connect.facebook.net/en_US/fbevents.js'"'"');\n  fbq('"'"'init'"'"', '"'"'1231230569192614'"'"');\n  fbq('"'"'track'"'"', '"'"'PageView'"'"');\n  </script>\n  <noscript><img height="1" width="1" style="display:none"\n  src="https://www.facebook.com/tr?id=1231230569192614&ev=PageView&noscript=1"\n  /></noscript>\n  <!-- End Meta Pixel Code -->'

echo "Installing Meta Pixel on all HTML files..."
count=0
for f in $DIR/*.html; do
    if grep -q "$PIXEL_ID" "$f"; then
        echo "  Already installed: $(basename $f)"
    else
        # Insert pixel before </head>
        sed -i '' "s|</head>|$PIXEL\n</head>|" "$f"
        echo "  ✓ Installed: $(basename $f)"
        count=$((count + 1))
    fi
done

# Add Lead event to form submissions
sed -i '' "s|nextStep(4);|fbq('track', 'Lead');\n  nextStep(4);|" $DIR/funnel.html
sed -i '' "s|nextStep(4);|fbq('track', 'Lead');\n  nextStep(4);|" $DIR/go.html 2>/dev/null

echo ""
echo "Done. $count files updated."
echo ""
echo "Now pushing to GitHub..."
cd $DIR
git config user.email "dilerbizz@gmail.com"
git config user.name "Diler Tabora"
git add -A
git commit -m "Install Meta Pixel 1231230569192614 — PageView + Lead events"
git push
echo ""
echo "✅ Done! Netlify will auto-deploy in ~30 seconds."
