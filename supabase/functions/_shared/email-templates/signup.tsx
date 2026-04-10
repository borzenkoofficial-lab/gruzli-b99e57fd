/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Подтвердите email для {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Подтвердите ваш email</Heading>
        <Text style={text}>
          Спасибо за регистрацию в{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Подтвердите ваш адрес (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ), нажав на кнопку ниже:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Подтвердить Email
        </Button>
        <Text style={footer}>
          Если вы не создавали аккаунт, просто проигнорируйте это письмо.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a1d2e',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#5b6abf', textDecoration: 'underline' }
const button = {
  backgroundColor: '#5b6abf',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '16px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
