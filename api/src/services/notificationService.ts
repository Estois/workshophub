export type NotifyEmployeeParams = {
  name: string
  email: string
  sessionTitle: string
  sessionDate: Date
  status: 'confirmed' | 'promoted'
}

export async function notifyEmployee(params: NotifyEmployeeParams): Promise<void> {
  try {
    const { name, email, sessionTitle, sessionDate, status } = params
    const isoDate = sessionDate.toISOString()

    console.log(`Notification: ${name} (${email}) is ${status} for "${sessionTitle}" on ${isoDate}`)

    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${name} (${email}) confirmed for ${sessionTitle} on ${isoDate}`,
          }),
        })
        if (!response.ok) {
          console.error(`notifyEmployee: Slack webhook responded with status ${response.status}`)
        }
      } catch (err) {
        console.error('notifyEmployee: Slack webhook delivery failed', err)
      }
    }
  } catch (err) {
    console.error('notifyEmployee: unexpected error', err)
  }
}
