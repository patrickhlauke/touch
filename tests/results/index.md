# Test results

Some of the more interesting data points from running my various [touch/pointer tests](http://patrickhlauke.github.io/touch) on a variety of devices/browsers. All tests carried out manually, trying to get the cleanest possible results (e.g. getting a "clean" tap without any finger movement).

See also [Peter-Paul Koch's <cite>Touch table</cite>](http://www.quirksmode.org/mobile/tableTouch.html), where he tests some further aspects beyond the scope of my tests.

## Touchscreen activation/tap event order

Browser | 1st tap | 2nd tap | tap out
-- | -- | -- | --
FirefoxOS 1.1 | `touchstart` > `touchend` > `mouseover` > `mouseenter` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
iOS7 / Safari/WebView | `touchstart` > `touchend` > `(mouseenter)` > `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` (see [webkit bug relating to `mouseenter`](https://bugs.webkit.org/show_bug.cgi?id=128534)) | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseleave` > `mouseout` (when tapping to another focusable/activatable element, otherwise `none`)
Android 4.3 / Chrome M32 | `touchstart` > `touchend` > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`blur`**_
Android 4.3 / Miren Browser, Maxthon Browser, Dolphin Browser, "Browser" (webkit 534.30) | _**`mouseover`**_ > _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 4.3 / UCBrowser 9.6 (webkit 533.1) | _**`mouseover`**_ > _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`blur`**_
Android 4.3 / Opera 19 (Blink) | `touchstart` > `touchend` > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `blur`
Android 4.3 / Opera Classic | `touchstart` > `touchend` > _**`mouseenter`**_ > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`mouseleave`**_ > `blur`
Android 4.3 / Firefox | `touchstart` > `touchend` > `mouseover` > _**`mouseenter`**_ > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`mouseleave`**_ > _**`blur`**_
Android 4.3 / Puffin (no touch event support) | `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout`
Blackberry Playbook 2.0 (2.1.0.1917) / "Browser" (webkit 536.2) | `touchstart` > _**`mouseover`**_ > _**`mousemove`**_ > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `touchstart` > _**`mousemove`**_ > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `mouseout`
Windows Phone 8 / IE10 (pointer events, vendor-prefixed)| _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > `focus` (if previously focus was somewhere else on page) > `MSPointerUp` > `mouseup` > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` > `focus` (if nothing previously focused on page) > `click` <hr> if moving finger slightly during press: _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > `focus` > [`MSPointerMove` > `mousemove`] > `MSPointerUp` > `mouseup` > _**`click`**_ > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` | _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > `MSPointerUp` > `mouseup` > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` > `click` <hr> if finger slightly moving during press: _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > [`MSPointerMove` > `mousemove`] > `MSPointerUp` > `mouseup` > _**`click`**_ > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` | `blur`

## Touchscreen + assistive technology event order

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
iOS7 / Safari/WebView + VoiceOver (with and without keyboard) | _**`focus`**_ | `touchstart` > `touchend` > `(mouseenter)` > `mouseover` > `mousemove` > `mousedown` > _**`blur`**_ > `mouseup` > `click` (see [webkit bug relating to `mouseenter`](https://bugs.webkit.org/show_bug.cgi?id=128534)) | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `blur` (when moving to another focusable element, otherwise `none`)<hr> `mouseleave` > `mouseout` (fired after element was already left, if original element was activated, and now another element was activated)
Android 4.3 / Chrome M32 + TalkBack (effectively ChromeVox) | `focus` | _**`blur`**_ > `mousedown` > `mouseup` > `click` > _**`focus`**_ | _**`blur`**_ > `mousedown` > `mouseup` > `click` > _**`focus`**_ | _**`blur`**_
Android 4.3 / Miren Browser, Maxthon Browser, Dolphin Browser, "Browser" (webkit 534.30) + TalkBack (effectively ChromeVox) | `focus` | `blur` > `mousedown` > `mouseup` > `click` > `focus` | `blur` > `mousedown` > `mouseup` > `click` > `focus`  | `blur`
Android 4.3 / Firefox + TalkBack | _**`none`**_ | `touchstart` > _**`mousedown`**_ > _**`focus`**_ > `touchend` > `mouseup` > `click` | `touchstart` > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `blur` (when moving to another focusable element, otherwise `none`)


## Touch devices with paired keyboard/mouse

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Android 4.3 / Chrome M32 + mouse | `mouseenter` > `mouseover` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseleave` > `mouseout`
Android 4.3 / Chrome M32 + keyboard | `focus` | `click` | `click` | `blur`
Android 4.3 / Opera 19 (Blink) + keyboard (no focus indication) | `focus` | `click` | `click` | `blur`
Blackberry Playbook 2.0 (2.1.0.1917) / "Browser" (webkit 536.2) + mouse |  _**`mouseover`**_ | _**`mousedown`**_ > _**`mouseup`**_ > _**`click`**_ | _**`mousedown`**_ > _**`mouseup`**_ > _**`click`**_ |  _**`mouseout`**_
Blackberry Playbook 2.0 (2.1.0.1917) / "Browser" (webkit 536.2) + keyboard | _**`focus`**_ | _**`click`**_ | _**`click`**_ | _**`blur`**_

iOS does not support paired mouse, paired keyboard only works in same situations as on-screen keyboard (e.g. when prompted to enter a web address, enter data in a text input) unless VoiceOver is also activated (in which case it supports full control, but acts the same as regular VoiceOver with touch gestures).

FirefoxOS (ZTE Open) currently does not support paired bluetooth mouse/keyboard. Windows Phone 8 (Nokia Lumia 520) does not support paired bluetooth mouse/keyboard.

## Desktop with touchscreen
Browser | 1st tap | 2nd tap | tap out
-- | -- | -- | --
Windows 8 / Chrome (supports touch events) | `touchstart` > `touchend` > `mouseover` > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout` > `blur`
Windows 8 / Firefox | `mouseover` > `mouseenter` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
Windows 8 / Opera 12 (Presto) | `mouseover` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
Windows 8 / Opera 20 (Blink) (supports touch events) | `touchstart` > `touchend` > `mouseover` > _**`mousemove`**_ > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > _**`mousedown`**_ > `mouseup` > `click` | `mouseout` > `blur`
Windows 8 / IE11 (supports pointer events) | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > (`gotpointercapture`) > `focus` > `pointermove` > `mousemove` > `pointerup` > `mouseup` > (`lostpointercapture`) > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > (`gotpointercapture`) > `pointermove` > `mousemove` > `pointerup` > `mouseup` > (`lostpointercapture`) > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` | `blur`

## Desktop with assistive technology

Using traditional <kbd>TAB</kbd> / <kbd>SHIFT</kbd>+<kbd>TAB</kbd> / <kbd>ENTER</kbd> keyboard navigation. Notice the faked mouse events in Chrome/JAWS/NVDA and Firefox/NVDA, which are not fired when assistive technology is not present.

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Windows 8 / Chrome + JAWS 15 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Chrome + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Chrome + Narrator | `focus` | `click` | `click` | `blur`
Windows 8 / IE11 + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / IE11 + NVDA 2014.1 | `focus` |  `click` | `click` | `blur`
Windows 8 / IE11 + Narrator | `focus` |  `click` | `click` | `blur`
Windows 8 / Firefox + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / Firefox + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur
Windows 8 / Firefox + Narrator | `focus` |  `click` | `click` | `blur`
Windows 8 / Opera 20 (Blink) + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / Opera 20 (Blink) + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Opera 20 (Blink) + Narrator | `focus` |  `click` | `click` | `blur`

Opera 12 (Presto) seems to have no support for assistive technology.

## Desktop with touchscreen and assistive technology

Using touch gestures (e.g. swipe left/right, double-tap to activate) and "touch explore", instead of traditional <kbd>TAB</kbd> / <kbd>SHIFT</kbd>+<kbd>TAB</kbd> / <kbd>ENTER</kbd> keyboard navigation.

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Windows 8 / Chrome + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Chrome + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Chrome + Narrator gesture navigation and touch explore | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / IE11 + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `focus` > `click` | `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / IE11 + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `focus` > `click` | `click` | _**`none`**_ (_**not even when moving to/activating another element**_)
Windows 8 / IE11 + Narrator gesture navigation and touch explore | _**`none`**_ | `focus` > `click` | `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Firefox + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Firefox + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `mousedown` > _**`focus`**_ > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur`
Windows 8 / Firefox + Narrator gesture navigation and touch explore | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Opera 20 (Blink) + JAWS 15 gesture navigation (no visible outline / focus indication) **[touch explore not working]** | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click`| `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Opera 20 (Blink) + NVDA 2014.1 gesture navigation _**and touch explore**_ (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` (only once moved to another focusable element **and** activated that element)
Windows 8 / Opera 20 (Blink) + Narrator gesture navigation **[touch explore not working]** | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click`| `blur` (only once moved to another focusable element **and** activated that element)

Opera 12 (Presto) seems to have no support for assistive technology.