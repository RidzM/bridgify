import { Link } from 'react-router'
import { AboutLayout } from './AboutLayout'

export default function AboutPage() {
  return (
    <AboutLayout title="About Bridgify" intro="A free, browser-based way to talk across speech, text, braille and sign.">
      <section>
        <h2>Who made it</h2>
        <p>Bridgify is the Semester VI Computer Engineering mini project of Riddhi Mehta, Vedika Misal, Siddhi Bhosale and Om Panjari at Vidyavardhini's College of Engineering &amp; Technology (University of Mumbai), 2025–26, mentored by Prof. Manali Payghan.</p>
      </section>
      <section>
        <h2>What it does</h2>
        <ul>
          <li>Text to speech and speech to text, with live captions.</li>
          <li>Text to braille and braille to text (Grade 1, Grade 2 and Hindi Bharati).</li>
          <li>Fingerspelling recognition for ASL and ISL, and text to sign in six sign languages.</li>
          <li>Gesture and expression recognition, Bridge for two-phone conversations, and an SOS card.</li>
          <li>Twelve display modes, including dyslexia, autism-friendly, low vision and high contrast.</li>
        </ul>
      </section>
      <section>
        <h2>What it is not</h2>
        <ul>
          <li>It recognises fingerspelled letters and looks signs up word by word. It does not translate sign language and is not a substitute for a qualified interpreter.</li>
          <li>Expression recognition is approximate.</li>
          <li>Moving letters (J and Z) are typed, not recognised.</li>
        </ul>
      </section>
      <section>
        <h2>More</h2>
        <ul>
          <li><Link to="/about/privacy">Privacy: what stays on your device</Link></li>
          <li><Link to="/about/evidence">Evidence: measured accuracy and test results</Link></li>
          <li><Link to="/about/credits">Credits: data, models and media we use</Link></li>
        </ul>
      </section>
    </AboutLayout>
  )
}
