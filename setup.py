from setuptools import setup

# Add this package data specification
package_data = {
    'datamapplot': ['deckgl_template.html', 'static/js/*.js', 'static/css/*.css']
}

if __name__ == '__main__':
    setup(package_data=package_data)
