import { PermissionAction } from '@supabase/shared-types/out/constants'
import dayjs from 'dayjs'
import { ExternalLink, Maximize2, Minimize2, Terminal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { object, string, boolean } from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'

import { useParams } from 'common'
import { FormFieldWrapper } from 'components/ui/Forms'
import { SectionHeader } from 'components/layouts/PageLayout'
import { getAPIKeys, useProjectSettingsV2Query } from 'data/config/project-settings-v2-query'
import { useCustomDomainsQuery } from 'data/custom-domains/custom-domains-query'
import { useEdgeFunctionQuery } from 'data/edge-functions/edge-function-query'
import { useEdgeFunctionDeleteMutation } from 'data/edge-functions/edge-functions-delete-mutation'
import { useEdgeFunctionUpdateMutation } from 'data/edge-functions/edge-functions-update-mutation'
import { useCheckPermissions } from 'hooks/misc/useCheckPermissions'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CodeBlock,
  CriticalIcon,
  Form_Shadcn_,
  Input,
  Modal,
  Switch,
  Toggle,
  cn,
} from 'ui'
import CommandRender from '../CommandRender'
import { generateCLICommands } from './EdgeFunctionDetails.utils'

const schema = object({
  name: string().required('Name is required'),
  verify_jwt: boolean().required(),
})

const EdgeFunctionDetails = () => {
  const router = useRouter()
  const { ref: projectRef, functionSlug } = useParams()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const { data: settings } = useProjectSettingsV2Query({ projectRef })
  const { data: customDomainData } = useCustomDomainsQuery({ projectRef })
  const { data: selectedFunction } = useEdgeFunctionQuery({ projectRef, slug: functionSlug })
  const { mutate: updateEdgeFunction, isLoading: isUpdating } = useEdgeFunctionUpdateMutation()
  const { mutate: deleteEdgeFunction, isLoading: isDeleting } = useEdgeFunctionDeleteMutation({
    onSuccess: () => {
      toast.success(`Successfully deleted "${selectedFunction?.name}"`)
      router.push(`/project/${projectRef}/functions`)
    },
  })

  const canUpdateEdgeFunction = useCheckPermissions(PermissionAction.FUNCTIONS_WRITE, '*')

  const { anonKey } = getAPIKeys(settings)
  const apiKey = anonKey?.api_key ?? '[YOUR ANON KEY]'

  const protocol = settings?.app_config?.protocol ?? 'https'
  const endpoint = settings?.app_config?.endpoint ?? ''
  const functionUrl =
    customDomainData?.customDomain?.status === 'active'
      ? `https://${customDomainData.customDomain.hostname}/functions/v1/${selectedFunction?.slug}`
      : `${protocol}://${endpoint}/functions/v1/${selectedFunction?.slug}`

  const { managementCommands, secretCommands, invokeCommands } = generateCLICommands({
    selectedFunction,
    functionUrl,
    anonKey: apiKey,
  })

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      verify_jwt: false,
    },
  })

  useEffect(() => {
    if (selectedFunction) {
      form.reset({
        name: selectedFunction.name,
        verify_jwt: selectedFunction.verify_jwt,
      })
    }
  }, [selectedFunction])

  const onUpdateFunction = async (values: any) => {
    if (!projectRef) return console.error('Project ref is required')
    if (selectedFunction === undefined) return console.error('No edge function selected')

    updateEdgeFunction(
      {
        projectRef,
        slug: selectedFunction.slug,
        payload: values,
      },
      {
        onSuccess: () => {
          toast.success(`Successfully updated edge function`)
        },
      }
    )
  }

  const onConfirmDelete = async () => {
    if (!projectRef) return console.error('Project ref is required')
    if (selectedFunction === undefined) return console.error('No edge function selected')
    deleteEdgeFunction({ projectRef, slug: selectedFunction.slug })
  }

  const hasImportMap = useMemo(
    () => selectedFunction?.import_map || selectedFunction?.import_map_path,
    [selectedFunction]
  )

  return (
    <>
      <SectionHeader title="Function Configuration" />
      <div className="mx-auto flex flex-col xl:flex-row gap-8 pb-8">
        <div className="flex-1 min-w-0 overflow-hidden">
          <Form_Shadcn_ {...form}>
            <form onSubmit={form.handleSubmit(onUpdateFunction)}>
              <Card>
                <CardContent>
                  <FormFieldWrapper
                    name="name"
                    control={form.control}
                    label="Name"
                    description="Your slug and endpoint URL will remain the same"
                  >
                    {(field) => (
                      <Input {...field} className="w-full" disabled={!canUpdateEdgeFunction} />
                    )}
                  </FormFieldWrapper>
                </CardContent>
                <CardContent>
                  <FormFieldWrapper
                    name="verify_jwt"
                    control={form.control}
                    label="Enforce JWT Verification"
                    description="Require a valid JWT in the authorization header when invoking the function"
                  >
                    {(field) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!canUpdateEdgeFunction}
                      />
                    )}
                  </FormFieldWrapper>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  {form.formState.isDirty && (
                    <Button type="default" onClick={() => form.reset()}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isUpdating}
                    disabled={!canUpdateEdgeFunction || !form.formState.isDirty}
                  >
                    Save changes
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form_Shadcn_>

          <SectionHeader title="Invoke function" />
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoke via cURL</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <CodeBlock
                    language="bash"
                    className="text-xs !mt-0 border-none"
                    value={`curl -L -X POST '${functionUrl}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  --data '{"name":"Functions"}'`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoke via supabase-js</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <CodeBlock
                    language="js"
                    hideLineNumbers
                    className="text-xs !mt-0 border-none"
                    value={`import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
const { data, error } = await supabase.functions.invoke('${selectedFunction?.name}', {
  body: { name: 'Functions' },
})`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <SectionHeader title="Develop locally" />
          <div className="rounded border bg-surface-100 px-6 py-4 drop-shadow-sm">
            <div className="space-y-6">
              <CommandRender
                commands={[
                  {
                    command: `supabase functions download ${selectedFunction?.slug}`,
                    description: 'Download the function to your local machine',
                    jsx: () => (
                      <>
                        <span className="text-brand-600">supabase</span> functions download{' '}
                        {selectedFunction?.slug}
                      </>
                    ),
                    comment: '1. Download the function',
                  },
                ]}
              />
              <CommandRender commands={[managementCommands[0]]} />
              <CommandRender commands={[managementCommands[1]]} />
            </div>
          </div>

          <div className="!mt-8">
            <Alert_Shadcn_ variant="destructive">
              <CriticalIcon />
              <AlertTitle_Shadcn_>
                Once your function is deleted, it can no longer be restored
              </AlertTitle_Shadcn_>
              <AlertDescription_Shadcn_>
                Make sure you have made a backup if you want to restore your edge function
              </AlertDescription_Shadcn_>
              <AlertDescription_Shadcn_ className="mt-3">
                <Button
                  type="danger"
                  disabled={!canUpdateEdgeFunction}
                  loading={selectedFunction?.id === undefined}
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete edge function
                </Button>
              </AlertDescription_Shadcn_>
            </Alert_Shadcn_>
          </div>
        </div>

        <div className="w-full xl:max-w-[600px] shrink-0">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <dl className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-y-6 gap-x-10">
                <dt className="text-sm text-foreground-light">Slug</dt>
                <dd className="text-sm lg:text-left">{selectedFunction?.slug}</dd>

                <dt className="text-sm text-foreground-light">Endpoint URL</dt>
                <dd className="text-sm lg:text-left">
                  <Input
                    className="font-mono input-mono"
                    disabled
                    copy
                    size="small"
                    value={functionUrl}
                  />
                </dd>

                <dt className="text-sm text-foreground-light">Region</dt>
                <dd className="text-sm lg:text-left">All functions are deployed globally</dd>

                <dt className="text-sm text-foreground-light">Created at</dt>
                <dd className="text-sm lg:text-left">
                  {dayjs(selectedFunction?.created_at ?? 0).format('dddd, MMMM D, YYYY h:mm A')}
                </dd>

                <dt className="text-sm text-foreground-light">Last updated at</dt>
                <dd className="text-sm lg:text-left">
                  {dayjs(selectedFunction?.updated_at ?? 0).format('dddd, MMMM D, YYYY h:mm A')}
                </dd>

                <dt className="text-sm text-foreground-light">Deployments</dt>
                <dd className="text-sm lg:text-left">{selectedFunction?.version ?? 0}</dd>

                <dt className="text-sm text-foreground-light">Import Maps</dt>
                <dd className="text-sm lg:text-left">
                  <p>
                    Import maps are{' '}
                    <span className={cn(hasImportMap ? 'text-brand' : 'text-amber-900')}>
                      {hasImportMap ? 'used' : 'not used'}
                    </span>{' '}
                    for this function
                  </p>
                  <p className="text-foreground-light mt-1">
                    Import maps allow the use of bare specifiers in functions instead of explicit
                    import URLs
                  </p>
                  <div className="mt-4">
                    <Button
                      asChild
                      type="default"
                      size="tiny"
                      icon={<ExternalLink strokeWidth={1.5} />}
                    >
                      <Link
                        href="https://supabase.com/docs/guides/functions/dependencies"
                        target="_blank"
                        rel="noreferrer"
                      >
                        More about import maps
                      </Link>
                    </Button>
                  </div>
                </dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        size="small"
        alignFooter="right"
        header={<h3>Confirm to delete {selectedFunction?.name}</h3>}
        visible={showDeleteModal}
        loading={isDeleting}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={onConfirmDelete}
      >
        <Modal.Content>
          <Alert_Shadcn_ variant="warning">
            <CriticalIcon />
            <AlertTitle_Shadcn_>This action cannot be undone</AlertTitle_Shadcn_>
            <AlertDescription_Shadcn_>
              Ensure that you have made a backup if you want to restore your edge function
            </AlertDescription_Shadcn_>
          </Alert_Shadcn_>
        </Modal.Content>
      </Modal>
    </>
  )
}

export default EdgeFunctionDetails
