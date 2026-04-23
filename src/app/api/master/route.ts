import { NextRequest } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { ok, badRequest, serverError } from '@/lib/api-response'

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'master.json')

interface MasterData {
  categories: string[]
  departments: string[]
  locations: string[]
  vendors: string[]
}

const DEFAULT_DATA: MasterData = {
  categories: ['노트북', '데스크탑', '모니터', '사무가구', '차량', '기계장치', '소프트웨어'],
  departments: ['경영지원부', 'IT개발팀', '영업팀', '마케팅팀', '회계팀'],
  locations: ['본사 1층', '본사 2층', '본사 3층', '본사 4층', '별관 A동', '창고'],
  vendors: ['삼성전자 서비스', 'LG전자 서비스', 'Dell 코리아', '현대자동차'],
}

type MasterKey = keyof MasterData
const VALID_KEYS: MasterKey[] = ['categories', 'departments', 'locations', 'vendors']

function readData(): MasterData {
  if (!existsSync(DATA_FILE)) return DEFAULT_DATA
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as MasterData
  } catch {
    return DEFAULT_DATA
  }
}

function writeData(data: MasterData) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// GET /api/master
export async function GET() {
  try {
    return ok(readData())
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/master  — body: { type, value }
export async function POST(request: NextRequest) {
  try {
    const { type, value } = await request.json()
    if (!VALID_KEYS.includes(type as MasterKey) || !value?.trim()) {
      return badRequest('type and value are required')
    }
    const data = readData()
    const key = type as MasterKey
    if (data[key].includes(value.trim())) {
      return badRequest('이미 존재하는 항목입니다.')
    }
    data[key] = [...data[key], value.trim()]
    writeData(data)
    return ok(data)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/master  — body: { type, value }
export async function DELETE(request: NextRequest) {
  try {
    const { type, value } = await request.json()
    if (!VALID_KEYS.includes(type as MasterKey) || !value) {
      return badRequest('type and value are required')
    }
    const data = readData()
    const key = type as MasterKey
    data[key] = data[key].filter((v) => v !== value)
    writeData(data)
    return ok(data)
  } catch (error) {
    return serverError(error)
  }
}
