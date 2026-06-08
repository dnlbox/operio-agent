# Lutron Lighting Controller Manual (Model-Quantum)

## Section 6 - Keypad and Scheduler Diagnostics

### Keypad Override and Communication Failures
If the common area lights fail to transition according to the program schedule:
1. **Manual Override:** Locate the Lutron main processor cabinet and use the keypad to manually set the zone overrides (Option 4).
2. **Troubleshoot Link Error:** Inspect the QS link wiring. Verify that the link status LED is blinking green (indicates normal communication). If the LED is solid red, check for short circuits.
3. **Firmware Reset:** Cycle the power to the processor board to clear pending communication buffers.

## Section 7 - Power Quality and Flicker Isolation

### Multi-Zone Flicker Versus Fixture Failure
When occupants report flickering, dimming, or repeated lamp burnout, determine whether the symptom is isolated to a fixture or shared across a zone:
1. **Single Fixture or Single Driver Failure:** If only one pendant, display track, or lamp head is affected while nearby fixtures remain stable, inspect the local lamp, LED driver, ballast, or dimming module first.
2. **Multiple Fixtures on Separate Runs Flicker Together:** Simultaneous flicker across separate store lighting runs usually indicates an upstream supply issue rather than several independent fixture failures. Inspect the panel feeder voltage, shared neutral integrity, and breaker terminations.
3. **Repeated Lamp Burnout After Replacement:** If replacement lamps or drivers fail again within 7 days, do not continue swapping fixtures without checking for over-voltage, loose neutral, or phase imbalance upstream.
4. **Escalation Threshold:** If measured line voltage fluctuates by more than 5% during normal operation, escalate to the building electrical panel owner before authorizing more fixture replacements.
