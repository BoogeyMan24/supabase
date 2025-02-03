import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogsDatePicker } from 'components/interfaces/Settings/Logs/Logs.DatePickers'
import { PREVIEWER_DATEPICKER_HELPERS } from 'components/interfaces/Settings/Logs/Logs.constants'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { expect, test, vi } from 'vitest'
import { render } from '../../helpers'

dayjs.extend(timezone)
dayjs.extend(utc)

const mockFn = vi.fn()

test('renders warning', async () => {
  const from = dayjs().subtract(10, 'days')
  const to = dayjs()

  render(
    <LogsDatePicker
      helpers={[]}
      onSubmit={mockFn}
      value={{
        from: from.toISOString(),
        to: to.toISOString(),
      }}
    />
  )
  userEvent.click(await screen.findByText(RegExp(from.format('DD MMM'))))

  await screen.findByText(/memory errors/)
  await screen.findByText(RegExp(from.format('DD MMM')))
})

test('renders dates in local time', async () => {
  const from = dayjs().subtract(1, 'days')
  const to = dayjs()
  render(
    <LogsDatePicker
      helpers={PREVIEWER_DATEPICKER_HELPERS}
      onSubmit={mockFn}
      value={{
        from: from.toISOString(),
        to: to.toISOString(),
      }}
    />
  )
  // renders time locally
  userEvent.click(await screen.findByText(RegExp(from.format('DD MMM'))))
  await screen.findByText(RegExp(from.format('DD MMM')))
})

test('renders datepicker selected dates in local time', async () => {
  const from = dayjs().date(25)
  const to = dayjs().date(27)
  render(
    <LogsDatePicker
      helpers={PREVIEWER_DATEPICKER_HELPERS}
      value={{
        from: from.toISOString(),
        to: to.toISOString(),
      }}
      onSubmit={mockFn}
    />
  )
  // renders time locally
  userEvent.click(await screen.findByText(RegExp(from.format('DD MMM'))))
  // inputs with local time
  await screen.findByText(
    `${from.format('DD MMM')}, ${from.format('HH:mm')} - ${to.format('DD MMM')}, ${to.format('HH:mm')}`
  )
  // selected date should be in local time
  await screen.findByText('25', { selector: "*[class*='--range-start'" })
  await screen.findByText('27', { selector: "*[class*='--range-end'" })
})

test('datepicker onSubmit will return ISO string of selected dates', async () => {
  const mockFn = vi.fn()
  const todayAt1300 = dayjs().hour(13).minute(0).second(0).millisecond(0).toISOString()
  const todayAt2359 = dayjs().hour(23).minute(59).second(59).millisecond(0).toISOString()

  render(
    <LogsDatePicker
      helpers={PREVIEWER_DATEPICKER_HELPERS}
      value={{
        from: todayAt1300,
        to: todayAt2359,
      }}
      onSubmit={mockFn}
    />
  )

  // open the datepicker
  userEvent.click(screen.getByText(/13:00/i))

  // screen.logTestingPlaygroundURL()

  // Find and click on the date elements
  const day20 = screen.getByText('23')
  userEvent.click(day20)

  const day21 = screen.getByText('24')
  userEvent.click(day21)

  userEvent.click(await screen.findByText('Apply'))
  expect(mockFn).toBeCalled()

  const call = mockFn.mock.calls[0][0]

  expect(call).toMatchObject({
    from: dayjs().date(23).hour(13).minute(0).second(0).millisecond(0).toISOString(),
    to: dayjs().date(24).hour(23).minute(59).second(59).millisecond(0).toISOString(),
  })
})

test('disabled helpers are disabled', async () => {
  const helpers = [
    {
      text: 'Last 7 days',
      from: () => dayjs().subtract(7, 'day').startOf('day').toISOString(),
      to: () => '',
      isHelper: true,
    },
    {
      text: 'Last 30 days',
      from: () => dayjs().subtract(30, 'day').startOf('day').toISOString(),
      to: () => '',
      isHelper: true,
      disabled: true,
    },
  ]

  const el = render(
    <LogsDatePicker
      helpers={helpers}
      onSubmit={mockFn}
      value={{
        from: dayjs().subtract(7, 'day').startOf('day').toISOString(),
        to: '',
        isHelper: true,
        text: 'Last 7 days',
      }}
    />
  )

  // click the datepicker
  userEvent.click(screen.getByText('Last 7 days'))

  const disabledHelper = el.getByText('Last 30 days')
  expect(disabledHelper).toHaveAttribute('aria-disabled', 'true')
})

test('passing a value prop shows the correct dates in the label', async () => {
  const from = dayjs().subtract(10, 'days')
  const to = dayjs()

  render(
    <LogsDatePicker
      helpers={[]}
      value={{ from: from.toISOString(), to: to.toISOString() }}
      onSubmit={mockFn}
    />
  )

  await screen.findByText(
    `${from.format('DD MMM')}, ${from.format('HH:mm')} - ${to.format('DD MMM')}, ${to.format('HH:mm')}`
  )

  // change the date
  userEvent.click(await screen.findByText(RegExp(from.format('DD MMM'))))
  userEvent.click(await screen.findByText(RegExp(to.format('DD MMM'))))

  await screen.findByText(
    `${from.format('DD MMM')}, ${from.format('HH:mm')} - ${to.format('DD MMM')}, ${to.format('HH:mm')}`
  )
})

test('passing a helper as a value prop shows the helper text in the label', async () => {
  const helper = {
    text: 'Last 7 days',
    from: () => dayjs().subtract(7, 'day').startOf('day').toISOString(),
    to: () => '',
    isHelper: true,
  }

  render(<LogsDatePicker helpers={[helper]} value={helper} onSubmit={mockFn} />)

  await screen.findByText(helper.text)
})
