'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusCircle, RefreshCcw, Wand2 } from 'lucide-react'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'
import { Modal } from '@/components/ui'

// ─── Zod 스키마 (서버 CreateAssetSchema와 동일) ───────────────────────────────
const schema = z.object({
  code:         z.string().min(1, '자산코드를 입력해주세요.'),
  name:         z.string().min(1, '자산명을 입력해주세요.'),
  category:     z.string().min(1),
  price:        z.number({ message: '숫자를 입력해주세요.' }).nonnegative('0 이상 입력해주세요.'),
  department:   z.string().min(1, '부서를 입력해주세요.'),
  location:     z.string().min(1, '위치를 입력해주세요.'),
  acquiredDate: z.string().min(1, '취득일을 선택해주세요.'),
  warrantyDate: z.string().optional(),
  barcode:      z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

const TODAY = new Date().toISOString().split('T')[0]

function generateCode() {
  const d = new Date()
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `ASSET-${yyyymmdd}-${String(Math.floor(Math.random() * 9000) + 1000)}`
}

const INPUT_CLS = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 transition-colors dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
const ERR_CLS   = 'mt-1 text-xs text-red-500'

export default function AssetCreateModal({ onClose, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code:         '',
      name:         '',
      category:     'IT_EQUIPMENT',
      price:        undefined,
      department:   '',
      location:     '',
      acquiredDate: TODAY,
      warrantyDate: '',
      barcode:      '',
    },
  })

  const onSubmit = async (data: FormValues) => {
    const res = await fetch('/api/assets', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        ...(data.warrantyDate && { warrantyDate: data.warrantyDate }),
        ...(data.barcode       && { barcode: data.barcode }),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '등록에 실패했습니다.')
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={<><PlusCircle className="w-5 h-5 mr-2 text-blue-600" />자산 신규 등록</>}
      onClose={onClose}
      size="lg"
      footer={
        <div className="p-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {isSubmitting
              ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />등록 중...</>
              : <><PlusCircle className="w-4 h-4 mr-2" />등록</>
            }
          </button>
        </div>
      }
    >
      <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>

        {/* 자산관리번호 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            자산관리번호 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              {...register('code')}
              placeholder="ASSET-20240101-1234"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 ${errors.code ? 'border-red-400' : 'border-slate-300'}`}
            />
            <button
              type="button"
              onClick={() => setValue('code', generateCode(), { shouldValidate: true })}
              className="flex items-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1" />자동생성
            </button>
          </div>
          {errors.code && <p className={ERR_CLS}>{errors.code.message}</p>}
        </div>

        {/* 품명 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            품명 (자산명) <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            placeholder="예: LG 그램 15인치"
            className={`${INPUT_CLS} ${errors.name ? 'border-red-400' : 'border-slate-300'}`}
          />
          {errors.name && <p className={ERR_CLS}>{errors.name.message}</p>}
        </div>

        {/* 분류 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            분류코드 <span className="text-red-500">*</span>
          </label>
          <select
            {...register('category')}
            className={`${INPUT_CLS} border-slate-300 bg-white dark:bg-slate-700`}
          >
            {Object.entries(ASSET_CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* 취득가액 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            취득가액 (원) <span className="text-red-500">*</span>
          </label>
          <input
            {...register('price', { valueAsNumber: true })}
            type="number"
            min="0"
            placeholder="1500000"
            className={`${INPUT_CLS} ${errors.price ? 'border-red-400' : 'border-slate-300'}`}
          />
          {errors.price && <p className={ERR_CLS}>{errors.price.message}</p>}
        </div>

        {/* 사업장 / 상세위치 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              사업장 <span className="text-red-500">*</span>
            </label>
            <input
              {...register('department')}
              placeholder="본사 / 3공장 / 수원연구소"
              className={`${INPUT_CLS} ${errors.department ? 'border-red-400' : 'border-slate-300'}`}
            />
            {errors.department && <p className={ERR_CLS}>{errors.department.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              상세위치/층 <span className="text-red-500">*</span>
            </label>
            <input
              {...register('location')}
              placeholder="3층 / A동 창고"
              className={`${INPUT_CLS} ${errors.location ? 'border-red-400' : 'border-slate-300'}`}
            />
            {errors.location && <p className={ERR_CLS}>{errors.location.message}</p>}
          </div>
        </div>

        {/* 취득일 / 보증기간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              취득일 <span className="text-red-500">*</span>
            </label>
            <input
              {...register('acquiredDate')}
              type="date"
              className={`${INPUT_CLS} ${errors.acquiredDate ? 'border-red-400' : 'border-slate-300'}`}
            />
            {errors.acquiredDate && <p className={ERR_CLS}>{errors.acquiredDate.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              보증기간 만료일
            </label>
            <input
              {...register('warrantyDate')}
              type="date"
              className={`${INPUT_CLS} border-slate-300`}
            />
          </div>
        </div>

        {/* 시리얼번호 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            시리얼번호 (선택)
          </label>
          <input
            {...register('barcode')}
            placeholder="제품 시리얼번호"
            className={`${INPUT_CLS} border-slate-300`}
          />
        </div>

      </form>
    </Modal>
  )
}
