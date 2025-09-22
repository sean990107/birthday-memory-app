#!/usr/bin/env node

/**
 * 🔍 部署前检查脚本
 * 验证所有必要的配置是否就绪
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 生日回忆册应用 - 部署前检查\n');

const checks = [];

// 检查必要文件
const requiredFiles = [
    'package.json',
    'render.yaml',
    'server/server.js',
    'server/package.json',
    'public/index.html',
    'public/script.js',
    'public/style.css',
    'env.example'
];

console.log('📁 检查必要文件...');
requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    if (exists) {
        console.log(`   ✅ ${file}`);
        checks.push(true);
    } else {
        console.log(`   ❌ ${file} - 文件缺失！`);
        checks.push(false);
    }
});

console.log('\n📦 检查package.json配置...');

// 检查根package.json
try {
    const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // 检查scripts
    const requiredScripts = ['start', 'install-all', 'build'];
    requiredScripts.forEach(script => {
        if (rootPkg.scripts && rootPkg.scripts[script]) {
            console.log(`   ✅ script: ${script}`);
            checks.push(true);
        } else {
            console.log(`   ❌ script: ${script} - 缺失！`);
            checks.push(false);
        }
    });
    
    // 检查engines
    if (rootPkg.engines && rootPkg.engines.node) {
        console.log(`   ✅ Node.js版本要求: ${rootPkg.engines.node}`);
        checks.push(true);
    } else {
        console.log(`   ⚠️  建议添加Node.js版本要求`);
        checks.push(true); // 不是严重错误
    }
    
    // 检查repository
    if (rootPkg.repository && rootPkg.repository.url) {
        if (rootPkg.repository.url.includes('your-username')) {
            console.log(`   ⚠️  repository URL需要更新为实际GitHub地址`);
            checks.push(true); // 不是严重错误
        } else {
            console.log(`   ✅ repository URL: ${rootPkg.repository.url}`);
            checks.push(true);
        }
    } else {
        console.log(`   ⚠️  建议添加repository URL`);
        checks.push(true); // 不是严重错误
    }
    
} catch (error) {
    console.log(`   ❌ package.json解析失败: ${error.message}`);
    checks.push(false);
}

console.log('\n🗄️ 检查服务端配置...');

// 检查server/package.json
try {
    const serverPkg = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
    
    // 检查关键依赖
    const requiredDeps = ['express', 'mongoose', 'multer', 'dotenv'];
    requiredDeps.forEach(dep => {
        if (serverPkg.dependencies && serverPkg.dependencies[dep]) {
            console.log(`   ✅ 依赖: ${dep}@${serverPkg.dependencies[dep]}`);
            checks.push(true);
        } else {
            console.log(`   ❌ 依赖: ${dep} - 缺失！`);
            checks.push(false);
        }
    });
    
} catch (error) {
    console.log(`   ❌ server/package.json解析失败: ${error.message}`);
    checks.push(false);
}

console.log('\n🌐 检查前端文件...');

// 检查index.html是否包含必要元素
try {
    const indexHtml = fs.readFileSync('public/index.html', 'utf8');
    
    if (indexHtml.includes('script.js')) {
        console.log('   ✅ script.js引用');
        checks.push(true);
    } else {
        console.log('   ❌ script.js引用缺失');
        checks.push(false);
    }
    
    if (indexHtml.includes('style.css')) {
        console.log('   ✅ style.css引用');
        checks.push(true);
    } else {
        console.log('   ❌ style.css引用缺失');
        checks.push(false);
    }
    
    if (indexHtml.includes('生日回忆册')) {
        console.log('   ✅ 应用标题正确');
        checks.push(true);
    } else {
        console.log('   ⚠️  应用标题可能需要确认');
        checks.push(true); // 不是严重错误
    }
    
} catch (error) {
    console.log(`   ❌ index.html读取失败: ${error.message}`);
    checks.push(false);
}

console.log('\n🚀 检查部署配置...');

// 检查render.yaml
try {
    const renderYaml = fs.readFileSync('render.yaml', 'utf8');
    
    if (renderYaml.includes('type: web')) {
        console.log('   ✅ Render web服务配置');
        checks.push(true);
    } else {
        console.log('   ❌ Render web服务配置缺失');
        checks.push(false);
    }
    
    if (renderYaml.includes('MONGODB_URI')) {
        console.log('   ✅ MongoDB环境变量配置');
        checks.push(true);
    } else {
        console.log('   ❌ MongoDB环境变量配置缺失');
        checks.push(false);
    }
    
} catch (error) {
    console.log(`   ❌ render.yaml读取失败: ${error.message}`);
    checks.push(false);
}

// 汇总结果
const totalChecks = checks.length;
const passedChecks = checks.filter(c => c).length;
const failedChecks = totalChecks - passedChecks;

console.log('\n' + '='.repeat(50));
console.log(`📊 检查结果统计:`);
console.log(`   ✅ 通过: ${passedChecks}/${totalChecks}`);
console.log(`   ❌ 失败: ${failedChecks}/${totalChecks}`);

if (failedChecks === 0) {
    console.log('\n🎉 恭喜！所有检查都通过了！');
    console.log('🚀 应用已准备好部署到Render平台！');
    console.log('\n📋 下一步操作:');
    console.log('   1. git add .');
    console.log('   2. git commit -m "🚀 Ready for deployment"');
    console.log('   3. git push origin main');
    console.log('   4. 在Render创建Web Service');
    process.exit(0);
} else {
    console.log('\n⚠️  发现问题需要修复！');
    console.log('📋 请修复上述❌标记的问题后重新运行检查。');
    process.exit(1);
}
