import { AboutLayout } from './AboutLayout'

export default function PrivacyPage() {
  return (
    <AboutLayout title="Privacy" intro="Your camera and microphone stay on your device. No account, no tracking.">
      <section>
        <h2>What never leaves your device</h2>
        <ul>
          <li>Camera images for sign, gesture and expression recognition. They are analysed in your browser and never uploaded or recorded.</li>
          <li>Microphone audio when you use on-device speech recognition (Whisper).</li>
          <li>Your display settings, SOS details and logs. They are stored in this browser only.</li>
        </ul>
      </section>
      <section>
        <h2>When something is sent</h2>
        <ul>
          <li>Speech to text in Chrome, Edge or Safari uses the browser's own speech service unless you turn on on-device recognition.</li>
          <li>The server voice (used only when your device has no voices) sends the text to be spoken.</li>
          <li>Text to sign asks the free sign.mt service for words that are not already in Bridgify.</li>
          <li>Bridge sends only the messages you choose to send (and, if you turn it on, hand-point coordinates, never video) directly to the other phone.</li>
        </ul>
      </section>
      <section>
        <h2>What we don't do</h2>
        <p>No analytics, no advertising, no cookies, no sign-in, and no storage of your messages on any server.</p>
      </section>
    </AboutLayout>
  )
}
