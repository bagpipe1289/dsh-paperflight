import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { dashboardVersionDefine } from './app-version'
export default defineConfig({plugins:[tailwindcss(),react()],define:dashboardVersionDefine,resolve:{alias:{'@':path.resolve(__dirname,'src')},dedupe:['@codemirror/state','@codemirror/view']},build:{target:'esnext'},server:{host:'127.0.0.1',port:3083,proxy:{'/api':{target:'http://127.0.0.1:3082',changeOrigin:true}}}})
