# Touch/pointer events test results

Some of the more interesting data points from running my various [touch/pointer tests](http://patrickhlauke.github.io/touch) on a variety of devices/browsers. All tests carried out manually, trying to get the cleanest possible results (e.g. getting a "clean" tap without any finger movement).

Some of these results first appeared in my presentation [Getting touchy - an introduction to touch and pointer events](http://www.slideshare.net/redux), but have since been retested and are now collated here for easier referencing.

See also [Peter-Paul Koch's <cite>Touch table</cite>](http://www.quirksmode.org/mobile/tableTouch.html), where he tests some further aspects beyond the scope of my tests.

<small>Last updated 12 April 2014.</small>

## Mobile/tablet touchscreen activation/tap event order

Browser | 1st tap | 2nd tap | tap out
-- | -- | -- | --
Firefox OS 1.1 | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mouseenter` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
iOS7.1 / Safari/WebView | `touchstart` > (`touchmove`)+ > `touchend` > `(mouseenter)` > `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseleave` > `mouseout` <small>(when tapping to another focusable/activatable element, otherwise `none`)</small>
Android 2.1 (HTC Hero) / "Internet" (WebKit 530.17)  | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 2.3.7 / "Browser" (WebKit 533.1)  | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 4.3 / Chrome M34 | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`blur`**_
Android 4.3 / Miren Browser, Maxthon Browser, Dolphin Browser (HD), "Browser" (WebKit 534.30) | _**`mouseover`**_ > _**`mousemove`**_ > `touchstart` > (`touchmove`)+ > `touchend` > `mousedown` > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > (`touchmove`)+ > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 4.3 / UCBrowser 9.6 (WebKit 533.1) | _**`mouseover`**_ > _**`mousemove`**_ > `touchstart` > (`touchmove`)+ > `touchend` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > (`touchmove`)+ > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`blur`**_
Android 4.3 / Opera 19 (Blink) | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `blur`
Android 4.3 / Opera Classic | `touchstart` > (`touchmove`)+ > `touchend` > _**`mouseenter`**_ > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`mouseleave`**_ > `blur`
Android 4.3 / Firefox 28 | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > _**`mouseenter`**_ > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchstart` > (`touchmove`)+ > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`mouseleave`**_ > _**`blur`**_
Android 4.3 / Puffin (no touch event support) | `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 4.4 / Maxthon Browser HD | `touchstart` > (`touchmove`)+ > `touchend` > `mouseover` > `mousemove` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | `touchend` > (`touchmove`)+ > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > _**`blur`**_
BlackBerry PlayBook 2.0 (2.1.0.1917) / "Browser" (WebKit 536.2) | `touchstart` > _**`mouseover`**_ > _**`mousemove`**_ > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `touchstart` > _**`mousemove`**_ > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `mouseout`
Windows Phone 8 / IE10 (pointer events, vendor-prefixed)| _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > _**`focus`**_ <small>(if previously focus was somewhere else on page)</small> > `MSPointerUp` > `mouseup` > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` > _**`focus`**_ <small>(if nothing previously focused on page)</small> > `click` <hr> if moving finger slightly during press:<br> _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > _**`focus`**_ > (`MSPointerMove` > `mousemove`)+ > `MSPointerUp` > `mouseup` > _**`click`**_ > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` | _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > `MSPointerUp` > `mouseup` > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` > `click` <hr> if moving finger slightly during press:<br> _**`mousemove`**_ > `MSPointerOver` > `mouseover` > `mouseenter` > `MSPointerDown` > `mousedown` > `MSGotPointerCapture` > (`MSPointerMove` > `mousemove`)+ > `MSPointerUp` > `mouseup` > _**`click`**_ > `MSLostPointerCapture` > `MSPointerOut` > `mouseout` > `mouseleave` | `blur`
Windows Phone 8.1 / IE11 (pointer events) | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > `gotpointercapture` > (`pointermove` > `mousemove`)+ > `pointerup` > `mouseup` > `lostpointercapture` > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > _**`focus`**_ <small>(if nothing previously focused on page)</small> > `click`  <hr> if moving finger slightly during press:<br>  `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > `gotpointercapture` > _**`pointermove`**_ > _**`mousemove`**_ > _**`focus`**_ > (`pointermove` > `mousemove`)+ > `pointerup` > `mouseup` > `lostpointercapture` > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > `gotpointercapture` > (`pointermove` > `mousemove`)+ > `pointerup` > `mouseup` > `lostpointercapture` > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` <hr> unable to replicate a tap with slight movement which does not result in a `pointercancel` | `blur` 

Generally, only a single ("sacrificial") `mousemove` is fired as part of the mouse compatibility events, just to rattle any legacy scripts that may be listening for this event.

There is a bug in WebKit (affecting iOS7.1/Safari and WebView) where `mouseenter` mouse compatibility event is not being fired correctly - see [Bug 128534 - `mouseenter` mouse compat event not fired when listeners for touch events](https://bugs.WebKit.org/show_bug.cgi?id=128534).

In the touch event model, mouse compatibility events (and final `click`) are only fired when a single finger is on the touchscreen. As soon as there's two or more (even outside of the element we're listening on), only touch events are fired and mouse compatibility events are suppressed.

If during the tap there is too much movement of the finger (based on browser-specific threshold), this is considered a gesture rather than a tap, and any mouse compatibility events (including `click`) are generally _**not**_ fired. There is a bug in current Blink implementations (again, Chrome M34 and related browsers) that, even on slight movement during tap, fires just a single `touchmove` and `touchcancel` - 

There appears to be a bug in older versions of Blink (noticed in Android/Chrome M34, Android/Opera, Android/Maxthon) where even the slightest movement during a tap results in `touchstart`, a _**single**_ `touchmove` only, and a `touchcancel`, with no further events being dispatched. This behavior is inconsistent with other implementations (as noted above, the result is usually `touchstart`, a few `touchmove` events, a `touchend` and then - provided the movement was within the threshold - the mouse compatibility and `click` events). Android/Chrome M35 (beta) seems to have fixed this bug - see [Issue 363319:	Swiping over a button with touch event handlers results in a single touchmove then touchcancel](https://code.google.com/p/chromium/issues/detail?id=363319).

## Mobile/tablet touchscreen + assistive technology event order
Using touch gestures (e.g. swipe left/right, double-tap to activate) and "touch explore".

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
iOS7.1 / Safari/WebView + VoiceOver (with and without keyboard) | _**`focus`**_ | `touchstart` > `touchend` > `mouseenter` > `mouseover` > `mousemove` > `mousedown` > _**`blur`**_ > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `blur` <small>(when moving to another focusable element, otherwise `none`)</small><hr> `mouseleave` > `mouseout` <small>(fired after element was already left, if original element was activated, and now another element was activated)</small>
Android 4.3 / Chrome M34 + TalkBack (effectively ChromeVox) | `focus` | _**`blur`**_ > `mousedown` > `mouseup` > `click` > _**`focus`**_ | _**`blur`**_ > `mousedown` > `mouseup` > `click` > _**`focus`**_ | _**`blur`**_
Android 4.3 / Miren Browser, Maxthon Browser, Dolphin Browser, "Browser" (WebKit 534.30) + TalkBack (effectively ChromeVox) | `focus` | `blur` > `mousedown` > `mouseup` > `click` > `focus` | `blur` > `mousedown` > `mouseup` > `click` > `focus`  | `blur`
Android 4.3 / Firefox 28 + TalkBack | _**`none`**_ | `touchstart` > _**`mousedown`**_ > _**`focus`**_ > `touchend` > `mouseup` > `click` | `touchstart` > _**`mousedown`**_ > `touchend` > `mouseup` > `click` | `blur` <small>(when moving to another focusable element, otherwise `none`)</small>

No assistive technology available (yet) for Firefox OS, Windows Phone 8 or BlackBerry PlayBook.

There is a bug in WebKit (affecting iOS7.1/Safari and WebView) where `mouseenter` mouse compatibility event is not being fired correctly - see [Bug 128534 - `mouseenter` mouse compat event not fired when listeners for touch events](https://bugs.WebKit.org/show_bug.cgi?id=128534).

## Mobile/tablet touch devices with paired keyboard/mouse

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Android 2.1 (HTC Hero) + built-in trackball / "Internet" (WebKit 530.17)  | _**`mouseover`**_ > _**`mousemove`**_ | _**`mousemove`**_ > _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousemove`**_ > _**`mousedown`**_ > _**`mouseup`**_ > `click` | `mouseout` <small>(when moving to another focusable element, otherwise `none`)</small>
Android 2.3.7 / "Browser" + mouse | _**`none`**_ | `touchstart` > `touchend` > `mouseover` > `mousemove` > `mousedown` > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout`
Android 4.3 / Chrome M34 + mouse | `mouseenter` > `mouseover` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > _**`focus`**_ > `mouseup` > `click` | _**`mousemove`**_ > `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseleave` > `mouseout`
Android 4.3 / Chrome M34 + keyboard | `focus` | `click` | `click` | `blur`
Android 4.3 / Opera 19 (Blink) + keyboard (no focus indication) | `focus` | `click` | `click` | `blur`
BlackBerry PlayBook 2.0 (2.1.0.1917) / "Browser" (WebKit 536.2) + mouse |  _**`mouseover`**_ | _**`mousedown`**_ > _**`mouseup`**_ > _**`click`**_ | _**`mousedown`**_ > _**`mouseup`**_ > _**`click`**_ |  _**`mouseout`**_
BlackBerry PlayBook 2.0 (2.1.0.1917) / "Browser" (WebKit 536.2) + keyboard | _**`focus`**_ | _**`click`**_ | _**`click`**_ | _**`blur`**_

iOS does not support paired mouse, paired keyboard only works in same situations as on-screen keyboard (e.g. when prompted to enter a web address, enter data in a text input) unless VoiceOver is also activated (in which case it supports full control, but acts the same as regular VoiceOver with touch gestures).

Firefox OS (ZTE Open) currently does not support paired bluetooth mouse/keyboard. Windows Phone 8 (Nokia Lumia 520) does not support paired bluetooth mouse/keyboard.

Android 2.3.7 only has partial keyboard support. It was not possible to successfully pair a keyboard or mouse with the Android 2.1 HTC Hero test device.

## Desktop with touchscreen
Browser | 1st tap | 2nd tap | tap out
-- | -- | -- | --
Windows 8 / Chrome 33 (supports touch events) | `touchstart` > `touchend` > `mouseover` > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > `touchend` > `mousedown` > `mouseup` > `click` | `mouseout` > `blur`
Windows 8 / Firefox 28 | `mouseover` > `mouseenter` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
Windows 8 / Opera 12 (Presto) | `mouseover` > `mousemove` > `mousedown` > `focus` > `mouseup` > `click` | `mousemove` > `mousedown` > `mouseup` > `click` | `mouseout` > `mouseleave` > `blur`
Windows 8 / Opera 20 (Blink) (supports touch events) | `touchstart` > `touchend` > `mouseover` > _**`mousemove`**_ > `mousedown` > `focus` > `mouseup` > `click` | `touchstart` > `touchend` > `mousemove` > _**`mousedown`**_ > `mouseup` > `click` | `mouseout` > `blur`
Windows 8 / IE11 (supports pointer events) | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > (`gotpointercapture`) > `focus` > `pointermove` > `mousemove` > `pointerup` > `mouseup` > (`lostpointercapture`) > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` | `mousemove` > `pointerover` > `mouseover` > `pointerenter` > `mouseenter` > `pointerdown` > `mousedown` > (`gotpointercapture`) > `pointermove` > `mousemove` > `pointerup` > `mouseup` > (`lostpointercapture`) > `pointerout` > `mouseout` > `pointerleave` > `mouseleave` > `click` | `blur`

## Desktop with assistive technology

Using traditional <kbd>TAB</kbd> / <kbd>SHIFT</kbd>+<kbd>TAB</kbd> / <kbd>ENTER</kbd> keyboard navigation. Notice the faked mouse events (particularly in OS X, when activating the test button with <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd> as prompted by VoiceOver), which are not fired when assistive technology is not present.

Included primarily as a point of comparison for the more specific case of desktop with touchscreen and assistive technology.

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Windows 8 / Chrome 33 + JAWS 15 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Chrome 33 + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Chrome 33 + Narrator | `focus` | `click` | `click` | `blur`
Windows 8 / IE11 + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / IE11 + NVDA 2014.1 | `focus` |  `click` | `click` | `blur`
Windows 8 / IE11 + Narrator | `focus` |  `click` | `click` | `blur`
Windows 8 / Firefox 28 + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / Firefox 28 + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur
Windows 8 / Firefox 28 + Narrator | `focus` |  `click` | `click` | `blur`
Windows 8 / Opera 20 (Blink) + JAWS 15 | `focus` |  `click` | `click` | `blur`
Windows 8 / Opera 20 (Blink) + NVDA 2014.1 | `focus` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | _**`mousedown`**_ > _**`mouseup`**_ > `click` | `blur`
Windows 8 / Opera 20 (Blink) + Narrator | `focus` |  `click` | `click` | `blur`
OS X 10.9.2 / Safari 7.0.2 + VoiceOver | `focus` | `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` > `mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> |  `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` > `mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> | `blur`
OS X 10.9.2 / Chrome 33 + VoiceOver | `focus` | `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` > `mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> |  `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` > `mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> | `blur`
OS X 10.9.2 / Firefox 29 + VoiceOver | `focus` | `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` > _**`blur`**_ >  `mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> |  `click` <br><small>(using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small><hr> `mousedown` >`mouseup` > `click` <br><small>(using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small> | `blur` <br><small>(if not activated or activated using <kbd>ENTER</kbd> or <kbd>SPACE</kbd>)</small> <hr> _**`none`**_ <br><small>(if activated using <kbd>CTRL</kbd>+<kbd>⌥ ALT</kbd>+<kbd>SPACE</kbd>)</small>

Opera 12 (Presto) on Windows, OS X and Opera 20 (Blink) on OS X seem to have no (workable) support for assistive technology.

## Desktop with touchscreen and assistive technology

Using touch gestures (e.g. swipe left/right, double-tap to activate) and "touch explore", instead of traditional <kbd>TAB</kbd> / <kbd>SHIFT</kbd>+<kbd>TAB</kbd> / <kbd>ENTER</kbd> keyboard navigation.

Browser | move to button | 1st activation | 2nd activation | leave button
-- | -- | -- | -- | --
Windows 8 / Chrome 33 + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Chrome 33 + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Chrome 33 + Narrator gesture navigation and touch explore | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / IE11 + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `focus` > `click` | `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / IE11 + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `focus` > `click` | `click` | _**`none`**_ <br><small>(_**not even when moving to/activating another element**_)</small>
Windows 8 / IE11 + Narrator gesture navigation and touch explore | _**`none`**_ | `focus` > `click` | `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Firefox 28 + JAWS 15 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Firefox 28 + NVDA 2014.1 gesture navigation and touch explore (no visible outline / focus indication) | _**`none`**_ | `mousedown` > _**`focus`**_ > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur`
Windows 8 / Firefox 28 + Narrator gesture navigation and touch explore | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Opera 20 (Blink) + JAWS 15 gesture navigation (no visible outline / focus indication) **[touch explore not working]** | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click`| `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Opera 20 (Blink) + NVDA 2014.1 gesture navigation _**and touch explore**_ (no visible outline / focus indication) | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | `mousedown` > `mouseup` > `click` | `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>
Windows 8 / Opera 20 (Blink) + Narrator gesture navigation **[touch explore not working]** | _**`none`**_ | _**`focus`**_ > `mousedown` > `mouseup` > `click` | _**`blur`**_ > _**`focus`**_ > `mousedown` > `mouseup` > `click`| `blur` <br><small>(only once moved to another focusable element **and** activated that element)</small>

Opera 12 (Presto) on Windows seems to have no support for assistive technology.