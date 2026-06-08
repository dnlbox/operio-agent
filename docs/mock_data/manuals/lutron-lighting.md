# Lutron Lighting Controller Manual (Model-Quantum)

## Section 6 - Keypad and Scheduler Diagnostics

### Keypad Override and Communication Failures
If the common area lights fail to transition according to the program schedule:
1. **Manual Override:** Locate the Lutron main processor cabinet and use the keypad to manually set the zone overrides (Option 4).
2. **Troubleshoot Link Error:** Inspect the QS link wiring. Verify that the link status LED is blinking green (indicates normal communication). If the LED is solid red, check for short circuits.
3. **Firmware Reset:** Cycle the power to the processor board to clear pending communication buffers.
